'use server';

import { prisma } from '@/lib/prisma';
import { getUserWithCapability } from '@/lib/authz';
import { revalidatePath } from 'next/cache';
import { InventoryStatus, OrderStatus } from '@prisma/client';
import { emitBusinessEvent } from '@/lib/domain/automation';

export async function updateOrderStatus({
  orderId,
  status,
}: {
  orderId: string;
  status: string;
}) {
  const user = await getUserWithCapability('MANAGE_ORDERS');
  if (!user) {
    return { error: 'Unauthorized.' };
  }

  if (!(Object.values(OrderStatus) as string[]).includes(status)) {
    return { error: `Unknown order status: ${status}` };
  }
  const nextStatus = status as OrderStatus;

  try {
    const previous = await prisma.order.findUnique({
      where: { id: orderId },
      select: { status: true },
    });
    if (!previous) {
      return { error: 'Order not found.' };
    }
    if (previous.status === nextStatus) {
      return { success: true };
    }

    const order = await prisma.$transaction(async (tx) => {
      const updated = await tx.order.update({
        where: { id: orderId },
        data: { status: nextStatus },
      });

      // Returned: put every item back into stock (once, on the transition)
      if (nextStatus === OrderStatus.RETURNED) {
        const items = await tx.orderItem.findMany({
          where: { orderId },
          include: { product: { select: { isUnique: true } } },
        });
        for (const item of items) {
          await tx.product.update({
            where: { id: item.productId },
            data: item.product.isUnique
              ? { inventoryStatus: InventoryStatus.AVAILABLE, quantity: 1 }
              : { quantity: { increment: item.quantity }, inventoryStatus: InventoryStatus.AVAILABLE },
          });
        }
      }

      return updated;
    });

    if (nextStatus === OrderStatus.DISPATCHED) {
      // Use the real shipment's tracking details when one exists
      const shipment = await prisma.shipment.findFirst({
        where: { orderId },
        orderBy: { createdAt: 'desc' },
      });
      try {
        await emitBusinessEvent('ORDER_DISPATCHED', {
          orderId,
          trackingNumber: shipment?.awb || shipment?.trackingNumber || null,
          trackingUrl: shipment?.trackingUrl || null,
          carrier: shipment?.courierName || null,
        });
      } catch (err) {
        console.error('Failed to emit ORDER_DISPATCHED:', err);
      }
    }

    // Log Activity
    await prisma.activityLog.create({
      data: {
        entityType: 'ORDER',
        entityId: orderId,
        action: `STATUS_${nextStatus}`,
        userId: user.id,
        metadata: JSON.stringify({ from: previous.status, to: nextStatus }),
      },
    });

    revalidatePath('/', 'layout');
    return { success: true, order };
  } catch (err: any) {
    return { error: err.message || 'Failed to update order status.' };
  }
}

export async function updateOrderPayment({
  orderId,
  paymentStatus,
}: {
  orderId: string;
  paymentStatus: 'PAID' | 'UNPAID' | 'REFUNDED';
}) {
  const user = await getUserWithCapability('MANAGE_ORDERS');
  if (!user) {
    return { error: 'Unauthorized.' };
  }

  try {
    const order = await prisma.order.update({
      where: { id: orderId },
      data: { paymentStatus },
    });

    if (paymentStatus === 'PAID') {
      try {
        await emitBusinessEvent('PAYMENT_RECEIVED', {
          orderId,
          orderNumber: order.orderNumber,
          customerId: order.customerId,
          amount: Number(order.total),
        });
      } catch (err) {
        console.error('Failed to emit PAYMENT_RECEIVED:', err);
      }
    }

    // Log Activity
    await prisma.activityLog.create({
      data: {
        entityType: 'ORDER',
        entityId: orderId,
        action: `PAYMENT_${paymentStatus}`,
        userId: user.id,
        metadata: JSON.stringify({ paymentStatus }),
      },
    });

    revalidatePath('/', 'layout');
    return { success: true, order };
  } catch (err: any) {
    return { error: err.message || 'Failed to update payment status.' };
  }
}
