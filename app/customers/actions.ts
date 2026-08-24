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
