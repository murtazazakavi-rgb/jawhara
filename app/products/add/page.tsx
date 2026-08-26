import React from 'react';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import AppShell from '@/components/AppShell';
import { prisma } from '@/lib/prisma';
import AddProductClient from './AddProductClient';

export const dynamic = 'force-dynamic';

export default async function AddProductPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/admin/login');
  }

  // 1. Fetch categories with attribute definitions
  const categories = await prisma.productCategory.findMany({
    where: { isActive: true },
    include: {
      attributeDefinitions: {
        orderBy: { sortOrder: 'asc' },
      },
    },
    orderBy: { name: 'asc' },
  });

  // 2. Fetch collections
  const collections = await prisma.collection.findMany({
    where: { status: 'ACTIVE' },
    orderBy: { name: 'asc' },
  });

  return (
    <AppShell user={user}>
      {/* Back button and page breadcrumbs */}
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
          <span className="font-label-sm uppercase tracking-widest text-on-surface">Add product</span>
        </div>
      </div>

      <AddProductClient categories={categories} collections={collections} />
    </AppShell>
  );
}
