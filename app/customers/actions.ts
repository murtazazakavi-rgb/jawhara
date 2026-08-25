'use server';

import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { normalizePhoneNumber } from '@/lib/phone';

export async function createCustomer(data: {
  name: string;
  mobile: string;
  email?: string;
  city?: string;
  notes?: string;
}) {
  const user = await getCurrentUser();
  if (!user) {
    return { error: 'Unauthorized.' };
  }

  if (!data.name.trim() || !data.mobile.trim()) {
    return { error: 'Name and mobile number are required.' };
  }

  try {
    const normalized = normalizePhoneNumber(data.mobile);
    const exists = await prisma.customer.findUnique({
      where: { normalizedMobile: normalized },
    });
    if (exists) {
      return { error: 'A customer with this mobile number already exists.' };
    }

    const customer = await prisma.customer.create({
      data: {
        name: data.name,
        mobile: data.mobile,
        normalizedMobile: normalized,
        email: data.email,
        city: data.city,
        notes: data.notes,
      },
    });

    // Log Activity
    await prisma.activityLog.create({
      data: {
        entityType: 'CUSTOMER',
        entityId: customer.id,
        action: 'CREATED',
        userId: user.id,
        metadata: JSON.stringify({ name: data.name, mobile: data.mobile }),
      },
    });

    revalidatePath('/customers');
    return { success: true, customer };
  } catch (err: any) {
    return { error: err.message || 'Failed to create customer.' };
  }
}

export async function deleteCustomerAction(id: string) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'OWNER' && user.role !== 'ADMIN') {
    return { error: 'Unauthorized.' };
  }

  try {
    // 1. Check if customer has any order history
    const orderCount = await prisma.order.count({
      where: { customerId: id },
    });

    if (orderCount > 0) {
      // Soft-archive because of order history constraints
      await prisma.customer.update({
        where: { id },
        data: { isArchived: true },
      });

      // Log Activity
      await prisma.activityLog.create({
        data: {
          entityType: 'CUSTOMER',
          entityId: id,
          action: 'DELETED',
          userId: user.id,
          metadata: JSON.stringify({ archived: true, reason: 'Has active orders' }),
        },
      });

      revalidatePath('/customers');
      return { success: true, archived: true };
    }

    // 2. No order history: perform cascade clean deletion
    await prisma.$transaction(async (tx) => {
      // Delete interactions
      await tx.customerInteraction.deleteMany({ where: { customerId: id } });
      
      // Delete campaigns recipient
      await tx.campaignRecipient.deleteMany({ where: { customerId: id } });
      
      // Delete reservations
      await tx.reservation.deleteMany({ where: { customerId: id } });
      
      // Delete conversations & messages
      const convs = await tx.whatsAppConversation.findMany({
        where: { customerId: id },
        select: { id: true },
      });
      const convIds = convs.map(c => c.id);
      if (convIds.length > 0) {
        await tx.whatsAppMessage.deleteMany({
          where: { conversationId: { in: convIds } },
        });
        await tx.whatsAppConversation.deleteMany({
          where: { id: { in: convIds } },
        });
      }

      // Finally delete customer
      await tx.customer.delete({ where: { id } });
    });

    // Log Activity
    await prisma.activityLog.create({
      data: {
        entityType: 'CUSTOMER',
        entityId: id,
        action: 'DELETED',
        userId: user.id,
        metadata: JSON.stringify({ hardDelete: true }),
      },
    });

    revalidatePath('/customers');
    return { success: true, hardDeleted: true };
  } catch (err: any) {
    return { error: err.message || 'Failed to delete customer.' };
  }
}
