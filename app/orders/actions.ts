'use server';

import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { InventoryStatus } from '@prisma/client';
import { emitBusinessEvent } from '@/lib/domain/automation';

export async function updateOrderStatus({
  orderId,
  status,
}: {
  orderId: string;
  status: string;
}) {
  const user = await getCurrentUser();
  if (!user) {
    return { error: 'Unauthorized.' };
  }

  try {
    const order = await prisma.order.update({
      where: { id: orderId },
      data: { status: status as any },
    });

    // If order is returned, we restore the stock and mark it as AVAILABLE
    const orderItem = await prisma.orderItem.findFirst({
      where: { orderId },
    });
    if (orderItem && status === 'RETURNED') {
      await prisma.product.update({
        where: { id: orderItem.productId },
        data: { 
          quantity: { increment: orderItem.quantity },
          inventoryStatus: 'AVAILABLE' 
        },
      });
    }

    if (status === 'DISPATCHED') {
      try {
        await emitBusinessEvent('ORDER_DISPATCHED', {
          orderId,
          trackingNumber: `TRK-${order.orderNumber}`,
          trackingUrl: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://jawhara-os.vercel.app'}/orders/${orderId}/receipt`,
          carrier: 'Priority Courier',
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
        action: `STATUS_${status}`,
        userId: user.id,
        metadata: JSON.stringify({ status }),
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
  const user = await getCurrentUser();
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

