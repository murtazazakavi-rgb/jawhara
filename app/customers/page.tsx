import React from 'react';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import AppShell from '@/components/AppShell';
import { prisma } from '@/lib/prisma';
import CustomersClient from './CustomersClient';

export const dynamic = 'force-dynamic';

export default async function CustomersPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/admin/login');
  }

  // Fetch all customers, including their paid orders to calculate total spend
  const rawCustomers = await prisma.customer.findMany({
    where: {
      isArchived: false,
    },
    include: {
      orders: {
        where: {
          paymentStatus: 'PAID',
        },
      },
    },
    orderBy: {
      name: 'asc',
    },
  });

  const customers = rawCustomers.map((c) => {
    const totalSpend = c.orders.reduce((sum, ord) => sum + Number(ord.total), 0);
    return {
      id: c.id,
      name: c.name,
      mobile: c.mobile,
      email: c.email,
      city: c.city,
      notes: c.notes,
      totalSpend,
    };
  });

  return (
    <AppShell user={user}>
      <CustomersClient initialCustomers={customers} />
    </AppShell>
  );
}
