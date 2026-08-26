import React from 'react';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getCurrentCustomer } from '@/lib/clientAuth';
import ShopDashboardClient from './ShopDashboardClient';

export const dynamic = 'force-dynamic';

export default async function CustomerDashboardPage() {
  const customer = await getCurrentCustomer();
  if (!customer) {
    redirect('/shop/login');
  }

  // 1. Fetch active holds (reservations)
  const rawHolds = await prisma.reservation.findMany({
    where: {
      customerId: customer.id,
      status: 'ACTIVE',
    },
    include: {
      product: {
        include: {
          images: {
            where: { isPrimary: true },
            take: 1,
          },
        },
      },
    },
    orderBy: { reservedAt: 'desc' },
  });

  const activeHolds = rawHolds.map((h) => ({
    id: h.id,
    expiresAt: h.expiresAt ? h.expiresAt.toISOString() : null,
    product: {
      id: h.product.id,
      productCode: h.product.productCode,
      name: h.product.name,
      price: Number(h.product.price),
      slug: h.product.slug,
      images: h.product.images.map((img) => ({ url: img.url })),
    },
  }));

  // 2. Fetch order invoices
  const rawOrders = await prisma.order.findMany({
    where: {
      customerId: customer.id,
    },
    include: {
      payments: {
        where: {
          status: 'CREATED',
        },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const orders = rawOrders.map((o) => {
    // If order has an unpaid PaymentRequest link, fetch it
    const activePaymentRequest = o.payments[0];
    const hasActivePaymentRequest = activePaymentRequest && (!activePaymentRequest.expiresAt || activePaymentRequest.expiresAt > new Date());
    const paymentUrl = hasActivePaymentRequest && activePaymentRequest.shortUrl
      ? activePaymentRequest.shortUrl
      : null;

    return {
      id: o.id,
      orderNumber: o.orderNumber,
      total: Number(o.total),
      status: o.status,
      paymentStatus: o.paymentStatus,
      createdAt: o.createdAt.toISOString(),
      paymentRequestUrl: paymentUrl,
    };
  });

  const chatMessages = customer.email ? await prisma.whatsAppConversation.findUnique({
    where: { waId: `email:${customer.email.toLowerCase().trim()}` },
    include: {
      messages: {
        orderBy: { createdAt: 'asc' },
      },
    },
  }).then(conv => conv?.messages.map(m => ({
    id: m.id,
    direction: m.direction,
    body: m.body,
    createdAt: m.createdAt.toISOString(),
  })) || []) : [];

  return (
    <ShopDashboardClient
      customerName={customer.name}
      activeHolds={activeHolds}
      orders={orders}
      isDefaultPassword={customer.password === '123456'}
      chatMessages={chatMessages}
    />
  );
}
