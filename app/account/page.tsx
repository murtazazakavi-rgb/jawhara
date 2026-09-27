import React from 'react';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getCurrentCustomer } from '@/lib/clientAuth';
import { isDefaultCustomerPassword } from '@/lib/security/customerPassword';
import AccountClient from './AccountClient';

export const dynamic = 'force-dynamic';

/** Customer account: orders, messages, profile and password. */
export default async function CustomerAccountPage() {
  const customer = await getCurrentCustomer();
  if (!customer) {
    redirect('/login?redirect=/account');
  }

  const rawOrders = await prisma.order.findMany({
    where: { customerId: customer.id },
    include: {
      orderItems: {
        include: {
          product: {
            select: {
              name: true,
              slug: true,
              images: { where: { isPrimary: true }, take: 1, select: { url: true } },
            },
          },
        },
      },
      payments: {
        where: { status: 'CREATED' },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
      shipments: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { courierName: true, awb: true, trackingNumber: true, trackingUrl: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const now = new Date();
  const orders = rawOrders.map((o) => {
    const payment = o.payments[0];
    const paymentUrl =
      payment && payment.shortUrl && (!payment.expiresAt || payment.expiresAt > now) ? payment.shortUrl : null;
    const shipment = o.shipments[0];

    return {
      id: o.id,
      orderNumber: o.orderNumber,
      total: Number(o.total),
      status: o.status,
      paymentStatus: o.paymentStatus,
      createdAt: o.createdAt.toISOString(),
      paymentUrl,
      items: o.orderItems.map((item) => ({
        id: item.id,
        name: item.product.name,
        slug: item.product.slug,
        quantity: item.quantity,
        imageUrl: item.product.images[0]?.url ?? null,
      })),
      tracking: shipment
        ? {
            courierName: shipment.courierName,
            number: shipment.awb || shipment.trackingNumber,
            url: shipment.trackingUrl,
          }
        : null,
    };
  });

  const conversation = await prisma.whatsAppConversation.findUnique({
    where: { waId: `email:${customer.email.toLowerCase().trim()}` },
    include: { messages: { orderBy: { createdAt: 'asc' } } },
  });
  const chatMessages = (conversation?.messages ?? []).map((m) => ({
    id: m.id,
    direction: m.direction,
    body: m.body,
    createdAt: m.createdAt.toISOString(),
  }));

  const { password: storedPassword } = await prisma.customer.findUniqueOrThrow({
    where: { id: customer.id },
    select: { password: true },
  });

  return (
    <AccountClient
      profile={{ name: customer.name, email: customer.email, mobile: customer.mobile }}
      orders={orders}
      chatMessages={chatMessages}
      isDefaultPassword={await isDefaultCustomerPassword(storedPassword)}
    />
  );
}
