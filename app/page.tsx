import React from 'react';
import { prisma } from '@/lib/prisma';
import { getCurrentCustomer } from '@/lib/clientAuth';
import { getCurrentUser } from '@/lib/auth';
import ShopClient from './shop/ShopClient';

export const dynamic = 'force-dynamic';

export default async function ClientLandingPage() {
  // 1. Fetch current client session context
  const customer = await getCurrentCustomer();
  const clientInfo = customer
    ? {
        id: customer.id,
        name: customer.name,
        mobile: customer.mobile,
      }
    : null;

  const adminUser = await getCurrentUser();
  const isAdmin = !!adminUser;

  // 2. Fetch categories
  const categories = await prisma.productCategory.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
    },
    orderBy: { name: 'asc' },
  });

  // 3. Fetch all published products (excluding ARCHIVED)
  const rawProducts = await prisma.product.findMany({
    where: {
      publishStatus: 'PUBLISHED',
    },
    include: {
      category: true,
      images: {
        orderBy: { sortOrder: 'asc' },
      },
      reservations: {
        where: { status: 'ACTIVE' },
        select: {
          expiresAt: true,
        },
        take: 1,
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Convert Decimals to Numbers to resolve client serialization errors
  const products = rawProducts.map((p) => ({
    id: p.id,
    productCode: p.productCode,
    name: p.name,
    slug: p.slug,
    price: Number(p.price),
    shortDesc: p.shortDesc,
    inventoryStatus: p.inventoryStatus,
    publishStatus: p.publishStatus,
    isUnique: p.isUnique,
    quantity: p.quantity,
    primaryColour: p.primaryColour,
    category: {
      id: p.category.id,
      name: p.category.name,
    },
    images: p.images.map((img) => ({
      url: img.url,
      isPrimary: img.isPrimary,
    })),
    activeReservation: p.reservations[0]
      ? { expiresAt: p.reservations[0].expiresAt ? p.reservations[0].expiresAt.toISOString() : null }
      : null,
  }));

  return (
    <ShopClient
      initialProducts={products}
      categories={categories}
      customer={clientInfo}
      isAdmin={isAdmin}
    />
  );
}
