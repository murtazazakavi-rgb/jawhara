import React from 'react';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import AppShell from '@/components/AppShell';
import { prisma } from '@/lib/prisma';
import OrdersClient from './OrdersClient';

export const dynamic = 'force-dynamic';

export default async function OrdersPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }

  // 1. Fetch orders including customer and item details
  const orders = await prisma.order.findMany({
    include: {
      customer: true,
      orderItems: {
        include: {
          product: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  // 2. Fetch metrics
  const totalOrders = await prisma.order.count();
  
  const pendingShipments = await prisma.order.count({
    where: {
      status: {
        in: ['PENDING', 'PACKING'],
      },
    },
  });

  const revenueResult = await prisma.order.aggregate({
    _sum: {
      total: true,
    },
    where: {
      paymentStatus: 'PAID',
    },
  });
  const totalRevenue = Number(revenueResult._sum.total || 0);

  const metrics = {
    totalOrders,
    pendingShipments,
    totalRevenue,
  };

  const serializedOrders = JSON.parse(JSON.stringify(orders));

  return (
    <AppShell user={user}>
      <OrdersClient initialOrders={serializedOrders} metrics={metrics} />
    </AppShell>
  );
}
