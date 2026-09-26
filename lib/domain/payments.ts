'use server';

/**
 * lib/domain/payments.ts
 *
 * Single authoritative payment finalization function.
 *
 * Both the Razorpay webhook handler and the client-side verify-payment route
 * call this function. It is idempotent: calling it twice with the same
 * providerPaymentId is safe and will return { alreadyProcessed: true } on
 * the second call.
 *
 * AI MUST NOT call this function. Payment finalization is deterministic
 * business logic — not an AI decision.
 */

import { prisma } from '@/lib/prisma';
import { emitBusinessEvent } from '@/lib/domain/automation';
import {
  OrderStatus,
  PaymentStatus,
  PaymentRequestStatus,
  ReservationStatus,
  InventoryStatus,
} from '@prisma/client';

export interface FinalizePaymentParams {
  /** Razorpay payment link ID (providerPaymentLinkId on PaymentRequest) */
  providerPaymentLinkId: string;
  /** Razorpay payment transaction ID */
  providerPaymentId: string;
  /** Amount paid in rupees */
  amountPaid: number;
  /** Payment method (upi, card, netbanking, etc.) */
  method: string;
  /** Raw Razorpay payment payload for audit storage */
  rawPayload?: Record<string, unknown>;
}

export interface FinalizePaymentResult {
  success: boolean;
  /** True when this payment was already recorded — caller should return 200 OK */
  alreadyProcessed: boolean;
  orderId?: string;
  orderNumber?: string;
  error?: string;
}

export async function finalizePayment(
  params: FinalizePaymentParams
): Promise<FinalizePaymentResult> {
  const { providerPaymentLinkId, providerPaymentId, amountPaid, method, rawPayload } = params;

  // ── 1. Locate the PaymentRequest ─────────────────────────────────────────
  const paymentRequest = await prisma.paymentRequest.findUnique({
    where: { providerPaymentLinkId },
    include: {
      order: {
        include: {
          orderItems: {
            include: { product: true },
          },
        },
      },
    },
  });

  if (!paymentRequest) {
    return {
      success: false,
      alreadyProcessed: false,
      error: `Payment request not found for provider link: ${providerPaymentLinkId}`,
    };
  }

  const order = paymentRequest.order;

  // ── 2. Idempotency check — order already PAID ─────────────────────────────
  if (order.paymentStatus === PaymentStatus.PAID) {
    console.log(
      `[finalizePayment] Order ${order.orderNumber} already PAID. Skipping (idempotent).`
    );
    return { success: true, alreadyProcessed: true, orderId: order.id, orderNumber: order.orderNumber };
  }

  // ── 3. Idempotency check — transaction already recorded ───────────────────
  const existingTransaction = await prisma.paymentTransaction.findUnique({
    where: { providerPaymentId },
  });

  if (existingTransaction) {
    console.log(
      `[finalizePayment] Transaction ${providerPaymentId} already registered. Skipping (idempotent).`
    );
    return { success: true, alreadyProcessed: true, orderId: order.id, orderNumber: order.orderNumber };
  }

  // ── 4. Execute the payment state machine in a single transaction ──────────
  try {
    await prisma.$transaction(async (tx) => {
      // A. Mark PaymentRequest as PAID
      await tx.paymentRequest.update({
        where: { id: paymentRequest.id },
        data: {
          status: PaymentRequestStatus.PAID,
          paidAt: new Date(),
        },
      });

      // B. Record PaymentTransaction for audit
      await tx.paymentTransaction.create({
        data: {
          orderId: order.id,
          paymentRequestId: paymentRequest.id,
          provider: 'RAZORPAY',
          providerPaymentId,
          amount: amountPaid || Number(paymentRequest.amount),
          currency: 'INR',
          status: 'captured',
          method,
          rawPayload: rawPayload ?? {},
        },
      });

      // C. Move order to PAID status → PACKING (ready for physical preparation)
      await tx.order.update({
        where: { id: order.id },
        data: {
          paymentStatus: PaymentStatus.PAID,
          status: OrderStatus.PACKING,
        },
      });

      // D. Resolve reservations and mark unique items SOLD
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

        // For unique (1-of-1) items, mark inventory SOLD
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

      // E. Audit log
      await tx.activityLog.create({
        data: {
          entityType: 'ORDER',
          entityId: order.id,
          action: 'PAYMENT_RECEIVED',
          metadata: JSON.stringify({
            amount: amountPaid || Number(paymentRequest.amount),
            method,
            transactionId: providerPaymentId,
            providerPaymentLinkId,
          }),
        },
      });
    });

    // ── 5. Emit business event (outside transaction — side effects) ───────────
    try {
      await emitBusinessEvent('PAYMENT_RECEIVED', {
        orderId: order.id,
        orderNumber: order.orderNumber,
        customerId: order.customerId,
        amount: amountPaid || Number(paymentRequest.amount),
      });
    } catch (eventErr) {
      // Non-fatal: WhatsApp/email notifications failing must not affect payment record
      console.error('[finalizePayment] Failed to emit PAYMENT_RECEIVED event:', eventErr);
    }

    console.log(
      `[finalizePayment] Payment confirmed for Order ${order.orderNumber}. Transaction: ${providerPaymentId}`
    );

    return {
      success: true,
      alreadyProcessed: false,
      orderId: order.id,
      orderNumber: order.orderNumber,
    };
  } catch (err: any) {
    console.error('[finalizePayment] Transaction failed:', err);
    return {
      success: false,
      alreadyProcessed: false,
      error: err.message || 'Payment finalization failed.',
    };
  }
}
