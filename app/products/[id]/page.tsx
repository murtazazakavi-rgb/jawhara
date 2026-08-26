import React from 'react';
import { notFound, redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import AppShell from '@/components/AppShell';
import { prisma } from '@/lib/prisma';
import ProductDetailsClient from './ProductDetailsClient';

export const dynamic = 'force-dynamic';

interface ProductDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function ProductDetailPage({ params }: ProductDetailPageProps) {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/admin/login');
  }

  const { id } = await params;

  // 1. Fetch Product
  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      category: true,
      collection: true,
      images: {
        orderBy: { sortOrder: 'asc' },
      },
      attributes: {
        include: {
          definition: true,
        },
      },
    },
  });

  if (!product) {
    notFound();
  }

  // 2. Fetch Active Reservation if any
  const activeReservation = await prisma.reservation.findFirst({
    where: {
      productId: id,
      status: 'ACTIVE',
    },
    include: {
      customer: true,
    },
  });

  // 3. Fetch All Customers for Selection Modals
  const customers = await prisma.customer.findMany({
    orderBy: { name: 'asc' },
  });

  // 4. Fetch Sales History for this Product
  const salesHistory = await prisma.orderItem.findMany({
    where: {
      productId: id,
    },
    include: {
      order: {
        include: {
          customer: true,
        },
      },
    },
    orderBy: {
      order: {
        createdAt: 'desc',
      },
    },
  });

  return (
    <AppShell user={user}>
      {/* Back navigation header */}
      <div className="flex items-center gap-4 mb-8">
        <a
          href="/products"
          className="text-on-surface-variant hover:text-primary transition-colors flex items-center justify-center p-2 rounded-full hover:bg-surface-container-high"
        >
          <span className="material-symbols-outlined">arrow_back</span>
        </a>
        <div className="flex items-center gap-2 text-outline">
          <span className="font-label-sm uppercase tracking-widest">Inventory</span>
          <span className="material-symbols-outlined text-xs">chevron_right</span>
          <span className="font-label-sm uppercase tracking-widest text-on-surface">Product details</span>
        </div>
      </div>

      <ProductDetailsClient
        product={product}
        customers={customers}
        activeReservation={activeReservation}
        salesHistory={salesHistory}
      />
    </AppShell>
  );
}
