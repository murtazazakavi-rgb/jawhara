import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import Razorpay from 'razorpay';
import { emitBusinessEvent } from '@/lib/domain/automation';
import { finalizePayment } from '@/lib/domain/payments';

/**
 * POST /api/verify-payment
 *
 * Called by the client-side after Razorpay redirect/callback.
 * Verifies the Razorpay signature and delegates payment finalization
 * to the single shared finalizePayment() function.
 *
 * This path is idempotent — if the Razorpay webhook already processed
 * the payment, finalizePayment() will return { alreadyProcessed: true }
 * and the client still receives a success response.
 */
export async function POST(request: Request) {
  let body: any = null;
  try {
    try {
      body = await request.json();
    } catch (e) {
      return NextResponse.json({ error: 'Invalid JSON request body.' }, { status: 400 });
    }

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;

    // Validate required fields
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 });
    }

    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      console.error('Razorpay credentials missing in environment.');
      return NextResponse.json({ error: 'Razorpay configuration error.' }, { status: 500 });
    }

    // ── 1. Verify Razorpay signature ─────────────────────────────────────────
    // HMAC-SHA256(order_id + "|" + payment_id, KEY_SECRET)
    const expectedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      console.warn('[verify-payment] Razorpay signature verification failed.');
      // Emit failure event for audit
      const pr = await prisma.paymentRequest.findUnique({
        where: { providerPaymentLinkId: razorpay_order_id },
      });
      if (pr) {
        try {
          await emitBusinessEvent('PAYMENT_FAILED', {
            orderId: pr.orderId,
            errorMsg: 'Razorpay signature verification failed.',
          });
        } catch (eventErr) {
          console.error('[verify-payment] Failed to emit PAYMENT_FAILED:', eventErr);
        }
      }
      return NextResponse.json(
        { error: 'Signature mismatch. Verification failed.' },
        { status: 400 }
      );
    }

    // ── 2. Fetch payment details from Razorpay for accurate amount/method ────
    const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });

    let paymentDetails: any = null;
    try {
      paymentDetails = await razorpay.payments.fetch(razorpay_payment_id);
    } catch (apiErr) {
      console.error('[verify-payment] Error fetching payment details from Razorpay:', apiErr);
      // Continue — finalizePayment will use the payment request amount as fallback
    }

    const method = paymentDetails?.method || 'unknown';
    const amountPaid = paymentDetails ? Number(paymentDetails.amount) / 100 : 0;

    // ── 3. Finalize payment using the single shared function ─────────────────
    const result = await finalizePayment({
      providerPaymentLinkId: razorpay_order_id,
      providerPaymentId: razorpay_payment_id,
      amountPaid,
      method,
      rawPayload: paymentDetails ?? {},
    });

    if (!result.success) {
      // Payment request not found — still return success to avoid exposing internals
      console.warn('[verify-payment] finalizePayment failed:', result.error);
      if (result.error?.includes('not found')) {
        // Not a client error — return success to Razorpay redirect flow
        return NextResponse.json({ success: true, message: 'Payment recorded.' });
      }
      try {
        if (body?.razorpay_order_id) {
          const pr = await prisma.paymentRequest.findUnique({
            where: { providerPaymentLinkId: body.razorpay_order_id },
          });
          if (pr) {
            await emitBusinessEvent('PAYMENT_FAILED', {
              orderId: pr.orderId,
              errorMsg: result.error,
            });
          }
        }
      } catch (eventErr) {
        console.error('[verify-payment] Failed to emit PAYMENT_FAILED:', eventErr);
      }
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Payment verified successfully.',
      orderId: result.orderId ?? null,
    });
  } catch (error: any) {
    console.error('[verify-payment] Unhandled error:', error);
    try {
      if (body?.razorpay_order_id) {
        const pr = await prisma.paymentRequest.findUnique({
          where: { providerPaymentLinkId: body.razorpay_order_id },
        });
        if (pr) {
          await emitBusinessEvent('PAYMENT_FAILED', {
            orderId: pr.orderId,
            errorMsg: error.message || 'Internal Verification Error.',
          });
        }
      }
    } catch (eventErr) {
      console.error('[verify-payment] Failed to emit PAYMENT_FAILED on error:', eventErr);
    }
    return NextResponse.json(
      { error: error.message || 'Internal Server Error.' },
      { status: 500 }
    );
  }
}
