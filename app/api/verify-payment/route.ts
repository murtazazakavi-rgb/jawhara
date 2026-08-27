import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import Razorpay from 'razorpay';
import { emitBusinessEvent } from '@/lib/domain/automation';
import { 
  OrderStatus, 
  PaymentStatus, 
  PaymentRequestStatus, 
  ReservationStatus, 
  InventoryStatus 
} from '@prisma/client';

export async function POST(request: Request) {
  try {
    let body;
    try {
      body = await request.json();
    } catch (e) {
      return NextResponse.json({ error: 'Invalid JSON request body.' }, { status: 400 });
    }

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;

    // Validate missing fields
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 });
    }

    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      console.error('Razorpay credentials missing in environment.');
      return NextResponse.json({ error: 'Razorpay configuration error.' }, { status: 500 });
    }

    // 1. Verify payment signature
    // Algorithm: HMAC-SHA256(order_id + "|" + payment_id, KEY_SECRET)
    const expectedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      console.warn('Razorpay signature verification failed.');
      // Find order to trigger failure notification
      const pr = await prisma.paymentRequest.findUnique({
        where: { providerPaymentLinkId: razorpay_order_id },
      });
      if (pr) {
        try {
          await emitBusinessEvent('PAYMENT_FAILED', {
            orderId: pr.orderId,
            errorMsg: 'Razorpay signature verification failed. Secure payment check mismatch.',
          });
        } catch (eventErr) {
          console.error('Failed to emit PAYMENT_FAILED:', eventErr);
        }
      }
      return NextResponse.json({ error: 'Signature mismatch. Verification failed.' }, { status: 400 });
    }

    // 2. Fetch payment details from Razorpay API to record transaction accurately
    const razorpay = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });

    let paymentDetails: any = null;
    try {
      paymentDetails = await razorpay.payments.fetch(razorpay_payment_id);
    } catch (apiErr) {
      console.error('Error fetching payment details from Razorpay:', apiErr);
    }

    const method = paymentDetails?.method || 'unknown';
    const amountPaid = paymentDetails ? Number(paymentDetails.amount) / 100 : 0;
    const status = paymentDetails?.status || 'captured';

    // 3. Find the associated PaymentRequest
    const paymentRequest = await prisma.paymentRequest.findUnique({
      where: { providerPaymentLinkId: razorpay_order_id },
      include: {
        order: {
          include: { 
            orderItems: {
              include: { product: true }
            } 
          }
        }
      }
    });

    if (paymentRequest) {
      const order = paymentRequest.order;

      // Avoid double processing if order is already paid
      if (order.paymentStatus !== PaymentStatus.PAID) {
        // Check if transaction already registered
        const existingTransaction = await prisma.paymentTransaction.findUnique({
          where: { providerPaymentId: razorpay_payment_id },
        });

        if (!existingTransaction) {
          // Execute transaction state machine transitions
          await prisma.$transaction(async (tx) => {
            // A. Update Payment Request status
            await tx.paymentRequest.update({
              where: { id: paymentRequest.id },
              data: {
                status: PaymentRequestStatus.PAID,
                paidAt: new Date(),
              },
            });

            // B. Record Payment Transaction
            await tx.paymentTransaction.create({
              data: {
                orderId: order.id,
                paymentRequestId: paymentRequest.id,
                provider: 'RAZORPAY',
                providerPaymentId: razorpay_payment_id,
                amount: amountPaid || paymentRequest.amount,
                currency: 'INR',
                status,
                method,
                rawPayload: paymentDetails || {},
              },
            });

            // C. Update Order payment status and lifecycle status to PACKING
            await tx.order.update({
              where: { id: order.id },
              data: {
                paymentStatus: PaymentStatus.PAID,
                status: OrderStatus.PACKING,
              },
            });

            // D. Close any active Reservations for products in this order and mark unique items SOLD
            for (const item of order.orderItems) {
              const activeRes = await tx.reservation.findFirst({
                where: {
                  productId: item.productId,
                  customerId: order.customerId,
                  status: 'ACTIVE',
                },
              });

              if (activeRes) {
                await tx.reservation.update({
                  where: { id: activeRes.id },
                  data: {
                    status: ReservationStatus.SOLD,
                    releasedAt: new Date(),
                    convertedToOrderAt: new Date(),
                  },
                });
              }

              // For unique items, enforce SOLD status
              if (item.product.isUnique) {
                await tx.product.update({
                  where: { id: item.productId },
                  data: {
                    inventoryStatus: InventoryStatus.SOLD,
                    soldAt: new Date(),
                    quantity: 0,
                  },
                });
              }
            }

            // E. Log Activity audit record
            await tx.activityLog.create({
              data: {
                entityType: 'ORDER',
                entityId: order.id,
                action: 'PAYMENT_RECEIVED',
                metadata: JSON.stringify({ amount: amountPaid || Number(paymentRequest.amount), method, transactionId: razorpay_payment_id }),
              },
            });
          });

          // F. Trigger notifications/automations via broker event
          try {
            await emitBusinessEvent('PAYMENT_RECEIVED', {
              orderId: order.id,
              orderNumber: order.orderNumber,
              customerId: order.customerId,
              amount: amountPaid || Number(paymentRequest.amount),
            });
          } catch (eventErr) {
            console.error('Failed to emit PAYMENT_RECEIVED event:', eventErr);
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Payment verified successfully.',
      orderId: paymentRequest ? paymentRequest.order.id : null,
    });
  } catch (error: any) {
    console.error('Verify payment API error:', error);
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
      console.error('Failed to emit PAYMENT_FAILED on verify error:', eventErr);
    }
    return NextResponse.json(
      { error: error.message || 'Internal Server Error.' },
      { status: 500 }
    );
  }
}
