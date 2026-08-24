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
