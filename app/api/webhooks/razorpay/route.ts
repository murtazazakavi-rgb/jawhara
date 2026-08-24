import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { emitBusinessEvent } from '@/lib/domain/automation';
import crypto from 'crypto';
import { 
  OrderStatus, 
  PaymentStatus, 
  PaymentRequestStatus, 
  ReservationStatus, 
  InventoryStatus, 
  WebhookProvider, 
  WebhookStatus 
} from '@prisma/client';

export async function POST(request: Request) {
  let rawBody = '';
  try {
    rawBody = await request.text();
    const signature = request.headers.get('X-Razorpay-Signature');
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

    // 1. Validate signature if configured (skip signature validation in dev if secret is empty)
    if (webhookSecret && signature) {
      const hmac = crypto.createHmac('sha256', webhookSecret).update(rawBody).digest('hex');
      if (signature !== hmac) {
        console.warn('Razorpay Webhook signature check failed.');
        return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
      }
    }

    const payload = JSON.parse(rawBody);
    const eventType = payload.event;
    const eventId = payload.id || `rzp-event-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

    // Create a WebhookEvent record to ensure idempotency
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

    // Handle Payment Link Paid Event
    if (eventType === 'payment_link.paid') {
      const rzpPaymentLink = payload.payload.payment_link.entity;
      const rzpPayment = payload.payload.payment.entity;

      const linkId = rzpPaymentLink.id;
      const orderId = rzpPaymentLink.reference_id; // reference_id maps to Order ID in our setup
      
      const paymentTransactionId = rzpPayment.id;
      const amountPaid = Number(rzpPayment.amount) / 100; // Convert paise back to rupees
      const method = rzpPayment.method;

      // Find the associated PaymentRequest
      const paymentRequest = await prisma.paymentRequest.findUnique({
        where: { providerPaymentLinkId: linkId },
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

      if (!paymentRequest) {
        console.warn(`Payment request not found for Razorpay link: ${linkId}`);
        await prisma.webhookEvent.update({
          where: { externalEventId: eventId },
          data: { status: WebhookStatus.FAILED, error: 'Payment request not found.' },
        });
        return NextResponse.json({ error: 'Payment request not found' }, { status: 404 });
      }

      const order = paymentRequest.order;

      // Check if order is already paid to enforce idempotency at business level
      if (order.paymentStatus === PaymentStatus.PAID) {
        console.log(`Order ${order.orderNumber} is already marked as PAID. Webhook execution skipped.`);
        await prisma.webhookEvent.update({
          where: { externalEventId: eventId },
          data: { status: WebhookStatus.PROCESSED, processedAt: new Date() },
        });
        return NextResponse.json({ success: true, message: 'Order already paid.' });
      }

      // Check transaction existence
      const existingTransaction = await prisma.paymentTransaction.findUnique({
        where: { providerPaymentId: paymentTransactionId },
      });

      if (existingTransaction) {
        console.log(`Transaction ${paymentTransactionId} already registered. Webhook execution skipped.`);
        await prisma.webhookEvent.update({
          where: { externalEventId: eventId },
          data: { status: WebhookStatus.PROCESSED, processedAt: new Date() },
        });
        return NextResponse.json({ success: true, message: 'Transaction already registered.' });
      }

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
            providerPaymentId: paymentTransactionId,
            amount: amountPaid,
            currency: 'INR',
            status: rzpPayment.status || 'captured',
            method,
            rawPayload: rzpPayment,
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
            metadata: JSON.stringify({ amount: amountPaid, method, transactionId: paymentTransactionId }),
          },
        });
      });

      // F. Trigger notifications/automations via broker event
      await emitBusinessEvent('PAYMENT_RECEIVED', {
        orderId: order.id,
        orderNumber: order.orderNumber,
        customerId: order.customerId,
        amount: amountPaid,
      });

      // Mark webhook event as processed
      await prisma.webhookEvent.update({
        where: { externalEventId: eventId },
        data: { status: WebhookStatus.PROCESSED, processedAt: new Date() },
      });

      console.log(`Payment confirmed for Order ${order.orderNumber}. Ref id: ${order.id}`);
      return NextResponse.json({ success: true });
    }

    // Default response for other webhook event types (e.g. payment_link.cancelled / expired)
    if (eventType === 'payment_link.cancelled' || eventType === 'payment_link.expired') {
      const rzpPaymentLink = payload.payload.payment_link.entity;
      const linkId = rzpPaymentLink.id;
      const status = rzpPaymentLink.status; // cancelled or expired

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

        // Emit webhook status change
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

    return NextResponse.json({ success: true, message: `Event ${eventType} skipped.` });
  } catch (error: any) {
    console.error('Razorpay Webhook handler error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
