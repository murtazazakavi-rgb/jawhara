import React from 'react';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getCurrentCustomer } from '@/lib/clientAuth';
import HoldsClient from './HoldsClient';

export const dynamic = 'force-dynamic';

/** Customer "My Holds": pieces currently held for this customer. */
export default async function CustomerHoldsPage() {
  const customer = await getCurrentCustomer();
  if (!customer) {
    redirect('/login?redirect=/dashboard');
  }

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
    orderBy: { expiresAt: 'asc' },
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

  return <HoldsClient customerName={customer.name} activeHolds={activeHolds} />;
}
