'use server';

import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { generateProductSKU } from '@/lib/domain/inventory';
import { Prisma } from '@prisma/client';

export async function createProduct(data: {
  name: string;
  categoryId: string;
  shortDesc?: string;
  description?: string;
  price: number;
  costPrice?: number;
  quantity: number;
  isUnique: boolean;
  publishStatus: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  primaryColour?: string;
  secondaryColours?: string;
  collectionId?: string;
  images: string[];
  attributes: { definitionId: string; value: string }[];
}) {
  const user = await getCurrentUser();
  if (!user) {
    return { error: 'Unauthorized.' };
  }

  if (!data.name.trim()) {
    return { error: 'Product name is required.' };
  }
  if (data.price <= 0) {
    return { error: 'Price must be greater than zero.' };
  }

  // Create slug from name
  const baseSlug = data.name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const uniqueId = Math.random().toString(36).substring(2, 6);
  const slug = `${baseSlug}-${uniqueId}`;

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Generate SKU code
      const productCode = await generateProductSKU(tx, data.categoryId);

      // 2. Create Product
      const product = await tx.product.create({
        data: {
          productCode,
          name: data.name,
          slug,
          categoryId: data.categoryId,
          shortDesc: data.shortDesc,
          description: data.description,
          price: new Prisma.Decimal(data.price),
          costPrice: data.costPrice ? new Prisma.Decimal(data.costPrice) : null,
          quantity: data.quantity,
          isUnique: data.isUnique,
          publishStatus: data.publishStatus,
          inventoryStatus: 'AVAILABLE',
          primaryColour: data.primaryColour,
          secondaryColours: data.secondaryColours,
          collectionId: data.collectionId || null,
          images: {
            create: data.images.map((url, idx) => ({
              url,
              sortOrder: idx,
              isPrimary: idx === 0,
            })),
          },
        },
      });

      // 3. Create Attributes values
      for (const attr of data.attributes) {
        if (attr.value && attr.value.trim() !== '') {
          await tx.productAttributeValue.create({
            data: {
              productId: product.id,
              definitionId: attr.definitionId,
              value: attr.value.trim(),
            },
          });
        }
      }

      // 4. Log Activity
      await tx.activityLog.create({
        data: {
          entityType: 'PRODUCT',
          entityId: product.id,
          action: 'CREATED',
          userId: user.id,
          metadata: JSON.stringify({ productCode, name: data.name }),
        },
      });

      return product;
    });

    revalidatePath('/', 'layout');
    return { success: true, productId: result.id, slug: result.slug };
  } catch (e: any) {
    console.error('Failed to create product:', e);
    return { error: e.message || 'Failed to create product in database.' };
  }
}
