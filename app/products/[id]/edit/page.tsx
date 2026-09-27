import React from 'react';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import AppShell from '@/components/AppShell';
import { prisma } from '@/lib/prisma';
import EditProductClient from './EditProductClient';

export const dynamic = 'force-dynamic';

interface EditProductPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function EditProductPage({ params }: EditProductPageProps) {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/admin/login');
  }

  const { id } = await params;

  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      category: {
        include: {
          attributeDefinitions: { orderBy: { sortOrder: 'asc' } },
        },
      },
      images: { orderBy: { sortOrder: 'asc' } },
      attributes: true,
    },
  });

  if (!product) {
    notFound();
  }

  // Active collections, plus the product's current one even if it's inactive
  const collections = await prisma.collection.findMany({
    where: product.collectionId
      ? { OR: [{ status: 'ACTIVE' }, { id: product.collectionId }] }
      : { status: 'ACTIVE' },
    orderBy: { name: 'asc' },
  });

  return (
    <AppShell user={user}>
      <div className="flex items-center gap-4 mb-8">
        <Link
          href={`/products/${product.id}`}
          className="hidden md:flex text-on-surface-variant hover:text-primary transition-colors items-center justify-center p-2 rounded-full hover:bg-surface-container-high"
          aria-label="Back to product"
        >
          <span className="material-symbols-outlined">arrow_back</span>
        </Link>
        <div className="flex items-center gap-2 text-outline min-w-0">
          <span className="font-label-sm uppercase tracking-widest">Inventory</span>
          <span className="material-symbols-outlined text-xs">chevron_right</span>
          <span className="font-label-sm uppercase tracking-widest text-on-surface truncate">
            Edit {product.productCode}
          </span>
        </div>
      </div>

      <EditProductClient
        product={{
          id: product.id,
          productCode: product.productCode,
          name: product.name,
          shortDesc: product.shortDesc,
          description: product.description,
          price: Number(product.price),
          costPrice: product.costPrice != null ? Number(product.costPrice) : null,
          quantity: product.quantity,
          isUnique: product.isUnique,
          primaryColour: product.primaryColour,
          secondaryColours: product.secondaryColours,
          collectionId: product.collectionId,
          categoryName: product.category.name,
          images: product.images.map((img) => img.url),
          attributes: Object.fromEntries(product.attributes.map((a) => [a.definitionId, a.value])),
        }}
        attributeDefinitions={product.category.attributeDefinitions.map((d) => ({
          id: d.id,
          name: d.name,
          fieldType: d.fieldType,
          required: d.required,
          options: d.options,
        }))}
        collections={collections.map((c) => ({ id: c.id, name: c.name }))}
      />
    </AppShell>
  );
}
