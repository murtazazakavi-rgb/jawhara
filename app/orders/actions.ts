'use server';

import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { InventoryStatus } from '@prisma/client';

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

    // If order is dispatched or delivered, we update the product inventory status too!
    const orderItem = await prisma.orderItem.findFirst({
      where: { orderId },
    });
    if (orderItem) {
      let invStatus: InventoryStatus = InventoryStatus.SOLD;
      if (status === 'DISPATCHED') invStatus = InventoryStatus.DISPATCHED;
      if (status === 'DELIVERED') invStatus = InventoryStatus.DELIVERED;
      if (status === 'RETURNED') invStatus = InventoryStatus.AVAILABLE;

      await prisma.product.update({
        where: { id: orderItem.productId },
        data: { inventoryStatus: invStatus },
      });
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
