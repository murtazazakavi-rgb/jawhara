'use server';

import { prisma } from '@/lib/prisma';
import { getUserWithCapability } from '@/lib/authz';
import { revalidatePath } from 'next/cache';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';

/**
 * Saves a system setting key-value pair.
 */
export async function saveSystemSetting(key: string, value: string) {
  const user = await getUserWithCapability('MANAGE_SETTINGS');
  if (!user) {
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
  const user = await getUserWithCapability('MANAGE_SETTINGS');
  if (!user) {
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
  const user = await getUserWithCapability('MANAGE_SETTINGS');
  if (!user) {
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
  const user = await getUserWithCapability('MANAGE_SETTINGS');
  if (!user) {
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

/**
 * Permanently deletes a category. Blocked while any product still uses it,
 * since product codes and printed tags depend on the category code.
 */
export async function deleteCategoryAction(id: string) {
  const user = await getUserWithCapability('MANAGE_SETTINGS');
  if (!user) {
    return { error: 'Unauthorized.' };
  }

  try {
    const productCount = await prisma.product.count({ where: { categoryId: id } });
    if (productCount > 0) {
      return {
        error: `Cannot delete — ${productCount} product${productCount === 1 ? ' is' : 's are'} in this category (including archived). Move or delete them first.`,
      };
    }

    await prisma.$transaction(async (tx) => {
      // Attribute definitions (and their values) belong to the category
      const definitions = await tx.attributeDefinition.findMany({
        where: { categoryId: id },
        select: { id: true },
      });
      const definitionIds = definitions.map((d) => d.id);
      if (definitionIds.length > 0) {
        await tx.productAttributeValue.deleteMany({ where: { definitionId: { in: definitionIds } } });
        await tx.attributeDefinition.deleteMany({ where: { id: { in: definitionIds } } });
      }
      await tx.productCategory.delete({ where: { id } });
    });

    await prisma.activityLog.create({
      data: {
        entityType: 'CATEGORY',
        entityId: id,
        action: 'DELETED',
        userId: user.id,
      },
    });

    revalidatePath('/settings');
    revalidatePath('/products');
    revalidatePath('/products/add');
    return { success: true };
  } catch (error: any) {
    return { error: error.message || 'Failed to delete category.' };
  }
}

/**
 * Creates a new administrative staff member (User model).
 */
export async function createStaffUserAction(data: {
  name: string;
  email: string;
  role: 'OWNER' | 'ADMIN' | 'SALES';
  password: string;
}) {
  const user = await getUserWithCapability('MANAGE_SETTINGS');
  if (!user) {
    return { error: 'Unauthorized.' };
  }

  if (!data.name.trim() || !data.email.trim() || !data.password.trim()) {
    return { error: 'Name, email, and password are required.' };
  }

  try {
    const existing = await prisma.user.findUnique({
      where: { email: data.email.toLowerCase().trim() },
    });
    if (existing) {
      return { error: 'A staff member with this email already exists.' };
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);
    const newStaff = await prisma.user.create({
      data: {
        name: data.name.trim(),
        email: data.email.toLowerCase().trim(),
        password: hashedPassword,
        role: data.role,
      },
    });

    // Log Activity
    await prisma.activityLog.create({
      data: {
        entityType: 'USER',
        entityId: newStaff.id,
        action: 'CREATED',
        userId: user.id,
        metadata: JSON.stringify({ email: newStaff.email, role: newStaff.role }),
      },
    });

    revalidatePath('/settings');
    return { success: true };
  } catch (error: any) {
    return { error: error.message || 'Failed to create staff member.' };
  }
}

/**
 * Sets a new temporary password for a staff member and returns it once, so
 * an owner/admin can pass it on. Admins cannot reset owner accounts.
 */
export async function resetStaffPasswordAction(targetId: string) {
  const user = await getUserWithCapability('MANAGE_SETTINGS');
  if (!user) {
    return { error: 'Unauthorized.' };
  }

  try {
    const target = await prisma.user.findUnique({
      where: { id: targetId },
      select: { id: true, email: true, role: true },
    });
    if (!target) {
      return { error: 'Staff member not found.' };
    }
    if (target.role === 'OWNER' && user.role !== 'OWNER') {
      return { error: 'Only owners can reset an owner\'s password.' };
    }

    // 12 characters from an unambiguous alphabet (no 0/O, 1/l/I)
    const alphabet = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
    const bytes = crypto.randomBytes(12);
    const temporaryPassword = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');

    await prisma.user.update({
      where: { id: target.id },
      data: { password: await bcrypt.hash(temporaryPassword, 10) },
    });

    await prisma.activityLog.create({
      data: {
        entityType: 'USER',
        entityId: target.id,
        action: 'PASSWORD_RESET',
        userId: user.id,
        metadata: JSON.stringify({ email: target.email }),
      },
    });

    return { success: true, temporaryPassword };
  } catch (error: any) {
    return { error: error.message || 'Failed to reset password.' };
  }
}

/**
 * Deletes an administrative staff member.
 */
export async function deleteStaffUserAction(targetId: string) {
  const user = await getUserWithCapability('MANAGE_SETTINGS');
  if (!user) {
    return { error: 'Unauthorized.' };
  }

  if (user.id === targetId) {
    return { error: 'You cannot delete your own administrative account.' };
  }

  try {
    const targetUser = await prisma.user.findUnique({ where: { id: targetId } });
    if (!targetUser) {
      return { error: 'User not found.' };
    }

    if (targetUser.role === 'OWNER' && user.role !== 'OWNER') {
      return { error: 'Only owners can delete other owner accounts.' };
    }

    await prisma.user.delete({
      where: { id: targetId },
    });

    // Log Activity
    await prisma.activityLog.create({
      data: {
        entityType: 'USER',
        entityId: targetId,
        action: 'DELETED',
        userId: user.id,
        metadata: JSON.stringify({ email: targetUser.email }),
      },
    });

    revalidatePath('/settings');
    return { success: true };
  } catch (error: any) {
    return { error: error.message || 'Failed to delete staff member.' };
  }
}

/**
 * Creates a new boutique collection.
 */
export async function createCollectionAction(data: {
  name: string;
  description?: string;
  coverImage?: string;
}) {
  const user = await getUserWithCapability('MANAGE_SETTINGS');
  if (!user) {
    return { error: 'Unauthorized.' };
  }

  if (!data.name.trim()) {
    return { error: 'Collection name is required.' };
  }

  const slug = data.name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

  try {
    const collection = await prisma.collection.create({
      data: {
        name: data.name.trim(),
        slug,
        description: data.description?.trim() || null,
        coverImage: data.coverImage?.trim() || null,
        status: 'ACTIVE',
      },
    });

    revalidatePath('/settings');
    revalidatePath('/products/add');
    return { success: true, collection };
  } catch (error: any) {
    return { error: error.message || 'Failed to create collection. Ensure the name is unique.' };
  }
}

/**
 * Toggles the active status of a collection.
 */
export async function toggleCollectionStatusAction(id: string, status: string) {
  const user = await getUserWithCapability('MANAGE_SETTINGS');
  if (!user) {
    return { error: 'Unauthorized.' };
  }

  try {
    await prisma.collection.update({
      where: { id },
      data: { status },
    });

    revalidatePath('/settings');
    revalidatePath('/products/add');
    return { success: true };
  } catch (error: any) {
    return { error: error.message || 'Failed to update collection status.' };
  }
}

/**
 * Deletes a collection.
 */
export async function deleteCollectionAction(id: string) {
  const user = await getUserWithCapability('MANAGE_SETTINGS');
  if (!user) {
    return { error: 'Unauthorized.' };
  }

  try {
    // Check if any products are linked to this collection
    const productCount = await prisma.product.count({
      where: { collectionId: id },
    });
    if (productCount > 0) {
      return { error: 'Cannot delete collection because it has products linked to it.' };
    }

    await prisma.collection.delete({
      where: { id },
    });

    revalidatePath('/settings');
    revalidatePath('/products/add');
    return { success: true };
  } catch (error: any) {
    return { error: error.message || 'Failed to delete collection.' };
  }
}
