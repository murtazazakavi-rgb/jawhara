'use server';

import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

/**
 * Saves a system setting key-value pair.
 */
export async function saveSystemSetting(key: string, value: string) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'OWNER' && user.role !== 'ADMIN') {
    return { error: 'Unauthorized.' };
  }

  try {
    await prisma.systemSetting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
    
    revalidatePath('/settings');
    return { success: true };
  } catch (error: any) {
    return { error: error.message || 'Failed to save setting.' };
  }
}

/**
 * Saves a WhatsApp message template mapping.
 */
export async function saveWhatsAppTemplate(data: {
  internalKey: string;
  metaTemplateName: string;
  languageCode: string;
  enabled: boolean;
}) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'OWNER' && user.role !== 'ADMIN') {
    return { error: 'Unauthorized.' };
  }

  try {
    await prisma.whatsAppTemplate.upsert({
      where: { internalKey: data.internalKey },
      update: {
        metaTemplateName: data.metaTemplateName,
        languageCode: data.languageCode,
        enabled: data.enabled,
      },
      create: {
        internalKey: data.internalKey,
        metaTemplateName: data.metaTemplateName,
        languageCode: data.languageCode,
        enabled: data.enabled,
      },
    });

    revalidatePath('/settings');
    return { success: true };
  } catch (error: any) {
    return { error: error.message || 'Failed to save template.' };
  }
}

/**
 * Creates a new product category.
 */
export async function createCategoryAction(data: {
  name: string;
  code: string;
  description?: string;
}) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'OWNER' && user.role !== 'ADMIN') {
    return { error: 'Unauthorized.' };
  }

  if (!data.name.trim() || !data.code.trim()) {
    return { error: 'Category name and single-letter code are required.' };
  }

  const slug = data.name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

  try {
    const category = await prisma.productCategory.create({
      data: {
        name: data.name,
        slug,
        code: data.code.toUpperCase().substring(0, 2),
        description: data.description,
        isActive: true,
      },
    });

    revalidatePath('/settings');
    revalidatePath('/products/add');
    return { success: true, category };
  } catch (error: any) {
    return { error: error.message || 'Failed to create category. Ensure name and code are unique.' };
  }
}

/**
 * Toggles the active status of a category.
 */
export async function toggleCategoryActiveAction(id: string, isActive: boolean) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'OWNER' && user.role !== 'ADMIN') {
    return { error: 'Unauthorized.' };
  }

  try {
    await prisma.productCategory.update({
      where: { id },
      data: { isActive },
    });

    revalidatePath('/settings');
    revalidatePath('/products/add');
    return { success: true };
  } catch (error: any) {
    return { error: error.message || 'Failed to update category status.' };
  }
}

