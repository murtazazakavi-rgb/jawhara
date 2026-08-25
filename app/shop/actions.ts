'use server';

import { prisma } from '@/lib/prisma';
import { sendWhatsAppMessage } from '@/lib/integrations/whatsapp/provider';
import { normalizePhoneNumber } from '@/lib/phone';
import { setCustomerSession, getCurrentCustomer } from '@/lib/clientAuth';
import { revalidatePath } from 'next/cache';
import { Prisma, MessageDirection, MessageStatus } from '@prisma/client';

/**
 * Authenticates a client using email and password.
 */
export async function clientLoginAction(data: {
  email: string;
  password: string;
}) {
  if (!data.email.trim() || !data.password.trim()) {
    return { error: 'Email and password are required.' };
  }

  try {
    const customer = await prisma.customer.findUnique({
      where: { email: data.email.toLowerCase().trim() },
    });

    if (!customer || customer.isArchived) {
      return { error: 'Invalid email or password.' };
    }

    if (customer.password !== data.password.trim()) {
      return { error: 'Invalid email or password.' };
    }

    // Start Customer session cookie
    await setCustomerSession({
      id: customer.id,
      email: customer.email,
      name: customer.name,
    });

    return { 
      success: true, 
      mustChangePassword: customer.password === '123456' 
    };
  } catch (error: any) {
    console.error('clientLoginAction error:', error);
    return { error: error.message || 'Login failed.' };
  }
}

/**
 * Registers a new client (demanding Name, Phone, and Password) and logs them in.
 */
export async function clientRegisterAndLoginAction(data: {
  email: string;
  password?: string;
  firstName: string;
  lastName: string;
  mobile: string;
  city?: string;
}) {
  if (!data.email.trim() || !data.firstName.trim() || !data.lastName.trim() || !data.mobile.trim()) {
    return { error: 'First name, last name, email, and mobile number are all required for registration.' };
  }

  const emailLower = data.email.toLowerCase().trim();
  const password = data.password?.trim() || '123456';
  const fullName = `${data.firstName.trim()} ${data.lastName.trim()}`;

  let normalized: string;
  try {
    normalized = normalizePhoneNumber(data.mobile);
  } catch (err) {
    return { error: 'Invalid mobile number format. Please include country code (e.g. +91...)' };
  }

  try {
    // Unique check email
    const emailExists = await prisma.customer.findUnique({
      where: { email: emailLower },
    });
    if (emailExists) {
      return { error: 'A customer with this email address already exists.' };
    }

    // Unique check mobile
    const mobileExists = await prisma.customer.findUnique({
      where: { normalizedMobile: normalized },
    });
    if (mobileExists) {
      return { error: 'A customer with this mobile phone number already exists.' };
    }

    // Create Customer
    const customer = await prisma.customer.create({
      data: {
        name: fullName,
        email: emailLower,
        mobile: data.mobile.trim(),
        normalizedMobile: normalized,
        password,
        city: data.city?.trim() || null,
        source: 'WEBSITE',
      },
    });

    // Start Customer session cookie
    await setCustomerSession({
      id: customer.id,
      email: customer.email,
      name: customer.name,
    });

    return { success: true, customer };
  } catch (error: any) {
    console.error('clientRegisterAndLoginAction error:', error);
    return { error: error.message || 'Registration failed.' };
  }
}

/**
 * Changes the logged-in client's password.
 */
export async function changeClientPasswordAction(data: {
  oldPassword: string;
  newPassword: string;
}) {
  const customer = await getCurrentCustomer();
  if (!customer) {
    return { error: 'Authentication required.' };
  }

  if (!data.oldPassword.trim() || !data.newPassword.trim()) {
    return { error: 'Both old and new passwords are required.' };
  }

  if (data.newPassword.trim() === '123456') {
    return { error: 'You cannot change your password back to the default password.' };
  }

  try {
    if (customer.password !== data.oldPassword.trim()) {
      return { error: 'Incorrect current password.' };
    }

    await prisma.customer.update({
      where: { id: customer.id },
      data: { password: data.newPassword.trim() },
    });

    return { success: true };
  } catch (error: any) {
    console.error('changeClientPasswordAction error:', error);
    return { error: error.message || 'Failed to change password.' };
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

/**
 * Submits a client inquiry or message, placing it directly into the admin's Sales Center WhatsApp thread.
 */
export async function clientSendMessageAction(data: {
  productId?: string;
  body: string;
}) {
  const customer = await getCurrentCustomer();
  if (!customer) {
    return { error: 'Authentication required. Please log in first.' };
  }

  if (!data.body.trim()) {
    return { error: 'Message cannot be empty.' };
  }

  try {
    const waId = customer.email ? `email:${customer.email.toLowerCase().trim()}` : '';
    if (!waId) {
      return { error: 'Customer email not found.' };
    }

    // Resolve product prefix details if any
    let prefix = '';
    if (data.productId) {
      const product = await prisma.product.findUnique({
        where: { id: data.productId },
      });
      if (product) {
        prefix = `[Inquiry: ${product.name} (${product.productCode})]\n`;
      }
    }

    const fullMessageText = `${prefix}${data.body.trim()}`;

    // Find or create conversation
    let conversation = await prisma.whatsAppConversation.findUnique({
      where: { waId },
    });

    if (!conversation) {
      conversation = await prisma.whatsAppConversation.create({
        data: {
          customerId: customer.id,
          waId,
          status: 'OPEN',
          lastMessageAt: new Date(),
        },
      });
    }

    // Add inbound message
    await prisma.whatsAppMessage.create({
      data: {
        conversationId: conversation.id,
        direction: MessageDirection.INBOUND,
        type: 'TEXT',
        status: MessageStatus.READ,
        body: fullMessageText,
        sentAt: new Date(),
      },
    });

    // Update conversation metadata
    await prisma.whatsAppConversation.update({
      where: { id: conversation.id },
      data: {
        lastMessageAt: new Date(),
        unreadCount: { increment: 1 },
      },
    });

    revalidatePath('/whatsapp');
    revalidatePath('/shop/dashboard');
    return { success: true };
  } catch (error: any) {
    console.error('clientSendMessageAction error:', error);
    return { error: error.message || 'Failed to send message.' };
  }
}

/**
 * Retrieves the client's conversation messages from the database.
 */
export async function getClientMessagesAction() {
  const customer = await getCurrentCustomer();
  if (!customer) {
    return { error: 'Unauthorized.' };
  }

  try {
    const waId = customer.email ? `email:${customer.email.toLowerCase().trim()}` : '';
    if (!waId) return { messages: [] };

    const conversation = await prisma.whatsAppConversation.findUnique({
      where: { waId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    return {
      messages: conversation?.messages.map((m) => ({
        id: m.id,
        direction: m.direction,
        body: m.body,
        createdAt: m.createdAt.toISOString(),
      })) || [],
    };
  } catch (error: any) {
    console.error('getClientMessagesAction error:', error);
    return { error: error.message || 'Failed to fetch messages.' };
  }
}
