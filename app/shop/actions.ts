'use server';

import { prisma } from '@/lib/prisma';
import { sendWhatsAppMessage } from '@/lib/integrations/whatsapp/provider';
import { normalizePhoneNumber } from '@/lib/phone';
import { setCustomerSession, getCurrentCustomer } from '@/lib/clientAuth';
import { revalidatePath } from 'next/cache';
import { Prisma } from '@prisma/client';

/**
 * Sends a 6-digit OTP code to the provided WhatsApp number.
 * If the customer is new, first and last name are required.
 */
export async function sendOtpAction(data: {
  mobile: string;
  firstName?: string;
  lastName?: string;
}) {
  if (!data.mobile.trim()) {
    return { error: 'Mobile number is required.' };
  }

  let normalized: string;
  try {
    normalized = normalizePhoneNumber(data.mobile);
  } catch (err) {
    return { error: 'Invalid mobile number format. Please include country code (e.g. +91...)' };
  }

  // Check if customer exists
  const existingCustomer = await prisma.customer.findUnique({
    where: { normalizedMobile: normalized },
  });

  if (!existingCustomer) {
    if (!data.firstName?.trim() || !data.lastName?.trim()) {
      return { 
        error: 'Registration required', 
        isNewCustomer: true 
      };
    }
  }

  // Generate 6-digit OTP
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry

  try {
    // Upsert OTP code
    await prisma.otpCode.upsert({
      where: { mobile: normalized },
      update: { code, expiresAt },
      create: { mobile: normalized, code, expiresAt },
    });

    // Send via WhatsApp
    const bodyText = `Your Jawhara Boutique verification code is: ${code}. Valid for 10 minutes.`;
    await sendWhatsAppMessage({
      to: normalized,
      type: 'text',
      text: {
        body: bodyText,
      },
    });

    return { success: true, isNewCustomer: !existingCustomer };
  } catch (error: any) {
    console.error('sendOtpAction error:', error);
    return { error: error.message || 'Failed to send OTP.' };
  }
}

/**
 * Verifies OTP code, signs up new customers, and starts a cookie session.
 */
export async function verifyOtpAction(data: {
  mobile: string;
  code: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  city?: string;
}) {
  if (!data.mobile.trim() || !data.code.trim()) {
    return { error: 'Mobile number and verification code are required.' };
  }

  let normalized: string;
  try {
    normalized = normalizePhoneNumber(data.mobile);
  } catch (err) {
    return { error: 'Invalid mobile number.' };
  }

  try {
    // Query OTP code
    const otpRecord = await prisma.otpCode.findUnique({
      where: { mobile: normalized },
    });

    if (!otpRecord || otpRecord.code !== data.code.trim()) {
      return { error: 'Invalid verification code.' };
    }

    if (otpRecord.expiresAt < new Date()) {
      return { error: 'Verification code has expired.' };
    }

    // Find or create customer
    let customer = await prisma.customer.findUnique({
      where: { normalizedMobile: normalized },
    });

    if (!customer) {
      if (!data.firstName?.trim() || !data.lastName?.trim()) {
        return { error: 'First name and last name are required for new registration.' };
      }
      
      const fullName = `${data.firstName.trim()} ${data.lastName.trim()}`;
      customer = await prisma.customer.create({
        data: {
          name: fullName,
          mobile: data.mobile.trim(),
          normalizedMobile: normalized,
          email: data.email?.trim() || null,
          city: data.city?.trim() || null,
          source: 'WEBSITE',
        },
      });
    }

    // Set Customer session
    await setCustomerSession({
      id: customer.id,
      mobile: customer.normalizedMobile,
      name: customer.name,
    });

    // Delete OTP record
    await prisma.otpCode.delete({
      where: { mobile: normalized },
    });

    return { success: true, customer };
  } catch (error: any) {
    console.error('verifyOtpAction error:', error);
    return { error: error.message || 'Failed to verify OTP.' };
  }
}

/**
 * Places a product on hold (Reservation) under the current customer's profile.
 */
export async function reserveProductAction(productId: string) {
  const customer = await getCurrentCustomer();
  if (!customer) {
    return { error: 'Authentication required. Please log in first.' };
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Fetch product
      const product = await tx.product.findUnique({
        where: { id: productId },
      });

      if (!product || product.publishStatus !== 'PUBLISHED') {
        throw new Error('This item is not available in the public catalog.');
      }

      if (product.inventoryStatus !== 'AVAILABLE' || product.quantity <= 0) {
        throw new Error('This piece is no longer available.');
      }

      // 2. Fetch reservation hold duration setting
      const holdSetting = await tx.systemSetting.findUnique({
        where: { key: 'reservationHoldMinutes' },
      });
      const holdMinutes = parseInt(holdSetting?.value || '30', 10);
      const expiresAt = new Date(Date.now() + holdMinutes * 60 * 1000);

      // 3. Atomic update product status
      if (product.isUnique) {
        const updateResult = await tx.product.updateMany({
          where: {
            id: productId,
            inventoryStatus: 'AVAILABLE',
            isUnique: true,
          },
          data: {
            inventoryStatus: 'RESERVED',
          },
        });

        if (updateResult.count === 0) {
          throw new Error('This unique piece was just reserved by another customer.');
        }
      } else {
        const updateResult = await tx.product.updateMany({
          where: {
            id: productId,
            isUnique: false,
            quantity: { gte: 1 },
          },
          data: {
            quantity: { decrement: 1 },
          },
        });

        if (updateResult.count === 0) {
          throw new Error('Out of stock.');
        }
      }

      // 4. Create Reservation
      const reservation = await tx.reservation.create({
        data: {
          productId,
          customerId: customer.id,
          reservedBy: `${customer.name} (Website)`,
          status: 'ACTIVE',
          expiresAt,
          quantity: 1,
        },
      });

      // 5. Log Customer Interaction
      await tx.customerInteraction.create({
        data: {
          customerId: customer.id,
          productId,
          type: 'RESERVED',
          metadata: { channel: 'CLIENT_PORTAL', durationMinutes: holdMinutes },
        },
      });

      return reservation;
    });

    revalidatePath('/shop');
    revalidatePath(`/p/${productId}`);
    return { success: true, reservation: result };
  } catch (error: any) {
    console.error('reserveProductAction error:', error);
    return { error: error.message || 'Failed to place item on hold.' };
  }
}

/**
 * Releases a hold reservation, returning the item back to active stock.
 */
export async function cancelReservationAction(reservationId: string) {
  const customer = await getCurrentCustomer();
  if (!customer) {
    return { error: 'Authentication required.' };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const reservation = await tx.reservation.findUnique({
        where: { id: reservationId },
        include: { product: true },
      });

      if (!reservation || reservation.customerId !== customer.id) {
        throw new Error('Reservation not found or unauthorized.');
      }

      if (reservation.status !== 'ACTIVE') {
        throw new Error('This hold is already inactive.');
      }

      // 1. Deactivate reservation
      await tx.reservation.update({
        where: { id: reservationId },
        data: {
          status: 'RELEASED',
          releasedAt: new Date(),
        },
      });

      // 2. Return product inventory stock
      if (reservation.product.isUnique) {
        await tx.product.update({
          where: { id: reservation.productId },
          data: { inventoryStatus: 'AVAILABLE' },
        });
      } else {
        await tx.product.update({
          where: { id: reservation.productId },
          data: { quantity: { increment: 1 } },
        });
      }

      // 3. Log interaction
      await tx.customerInteraction.create({
        data: {
          customerId: customer.id,
          productId: reservation.productId,
          type: 'PRODUCT_VIEW',
          metadata: { releasedFromHold: true },
        },
      });
    });

    revalidatePath('/shop');
    return { success: true };
  } catch (error: any) {
    console.error('cancelReservationAction error:', error);
    return { error: error.message || 'Failed to release reservation.' };
  }
}
