import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { emitBusinessEvent } from '@/lib/domain/automation';
import { finalizePayment } from '@/lib/domain/payments';
import {
  createRazorpayWebhookEventId,
  insecureRazorpayWebhooksAreAllowed,
  verifyRazorpayWebhookSignature,
} from '@/lib/security/payments';
import {
  PaymentRequestStatus,
  WebhookProvider,
  WebhookStatus,
} from '@prisma/client';

export async function POST(request: Request) {
  let rawBody = '';
  try {
    rawBody = await request.text();
    const signature = request.headers.get('X-Razorpay-Signature');
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

    // Webhooks are public endpoints and must authenticate themselves. An
    // unsigned development escape hatch exists only when explicitly enabled.
    if (!webhookSecret) {
      if (!insecureRazorpayWebhooksAreAllowed()) {
        console.error('Razorpay webhook rejected because authentication is not configured.');
        return NextResponse.json({ error: 'Webhook authentication unavailable.' }, { status: 503 });
      }
      console.warn('Accepting an unsigned Razorpay webhook in explicitly enabled development mode.');
    } else if (!signature) {
      if (!insecureRazorpayWebhooksAreAllowed()) {
        return NextResponse.json({ error: 'Missing signature.' }, { status: 401 });
      }
      console.warn('Accepting an unsigned Razorpay webhook in explicitly enabled development mode.');
    } else if (!verifyRazorpayWebhookSignature({ rawBody, signature, secret: webhookSecret })) {
      console.warn('Razorpay webhook signature check failed.');
      return NextResponse.json({ error: 'Invalid signature.' }, { status: 401 });
    }

    const payload = JSON.parse(rawBody);
    const eventType = payload.event;
    const eventId = createRazorpayWebhookEventId(rawBody, payload.id);

    // Record WebhookEvent for idempotency — duplicate events return 200 immediately
    try {
      await prisma.webhookEvent.create({
        data: {
          provider: WebhookProvider.RAZORPAY,
          externalEventId: eventId,
          eventType,
          payload: payload,
          status: WebhookStatus.RECEIVED,
        },
      });
    } catch (dbErr: any) {
      if (dbErr.code === 'P2002') {
        console.log(`Duplicate Razorpay event ${eventId} received. Skipping processing.`);
        return NextResponse.json({ success: true, message: 'Already processed.' });
      }
      throw dbErr;
    }

    // ── payment_link.paid ────────────────────────────────────────────────────
    if (eventType === 'payment_link.paid') {
      const rzpPaymentLink = payload.payload.payment_link.entity;
      const rzpPayment = payload.payload.payment.entity;

      const result = await finalizePayment({
        providerPaymentLinkId: rzpPaymentLink.id,
        providerPaymentId: rzpPayment.id,
        amountPaid: Number(rzpPayment.amount) / 100,
        method: rzpPayment.method,
        rawPayload: rzpPayment,
      });

      if (!result.success) {
        console.warn(`[Razorpay webhook] finalizePayment failed: ${result.error}`);
        await prisma.webhookEvent.update({
          where: { externalEventId: eventId },
          data: { status: WebhookStatus.FAILED, error: result.error },
        });
        // Return 404 only for missing payment request so Razorpay doesn't retry forever
        if (result.error?.includes('not found')) {
          return NextResponse.json({ error: result.error }, { status: 404 });
        }
        return NextResponse.json({ error: result.error }, { status: 500 });
      }

      await prisma.webhookEvent.update({
        where: { externalEventId: eventId },
        data: { status: WebhookStatus.PROCESSED, processedAt: new Date() },
      });

      console.log(
        `[Razorpay webhook] Payment confirmed for Order ${result.orderNumber}${result.alreadyProcessed ? ' (already processed)' : ''}.`
      );
      return NextResponse.json({ success: true });
    }

    // ── payment_link.cancelled / expired ─────────────────────────────────────
    if (eventType === 'payment_link.cancelled' || eventType === 'payment_link.expired') {
      const rzpPaymentLink = payload.payload.payment_link.entity;
      const linkId = rzpPaymentLink.id;
      const status = rzpPaymentLink.status;

      const pr = await prisma.paymentRequest.findUnique({
        where: { providerPaymentLinkId: linkId },
      });

      if (pr) {
        let dbStatus: PaymentRequestStatus = PaymentRequestStatus.CANCELLED;
        if (status === 'expired') dbStatus = PaymentRequestStatus.EXPIRED;

        await prisma.paymentRequest.update({
          where: { id: pr.id },
          data: { status: dbStatus },
        });

        await emitBusinessEvent('PAYMENT_LINK_EXPIRED', {
          paymentRequestId: pr.id,
          orderId: pr.orderId,
          status,
        });
      }

      await prisma.webhookEvent.update({
        where: { externalEventId: eventId },
        data: { status: WebhookStatus.PROCESSED, processedAt: new Date() },
      });

      return NextResponse.json({ success: true });
    }

    // ── All other event types ────────────────────────────────────────────────
    await prisma.webhookEvent.update({
      where: { externalEventId: eventId },
      data: { status: WebhookStatus.PROCESSED, processedAt: new Date() },
    });
    return NextResponse.json({ success: true, message: `Event ${eventType} skipped.` });
  } catch (error: any) {
    console.error('Razorpay Webhook handler error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
