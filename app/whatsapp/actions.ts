'use server';

import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { sendWhatsAppMessage } from '@/lib/integrations/whatsapp/provider';
import { revalidatePath } from 'next/cache';
import { MessageDirection, MessageStatus, Prisma } from '@prisma/client';
import { generateSuggestedReplies } from '@/lib/ai';

/**
 * Fetches all conversations with their customer profile, sorted by latest message activity.
 */
export async function getConversations() {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized.');

  return prisma.whatsAppConversation.findMany({
    include: {
      customer: true,
    },
    orderBy: {
      lastMessageAt: 'desc',
    },
  });
}

/**
 * Fetches messages in a conversation thread. Clear unread counts for that thread.
 */
export async function getConversationMessages(conversationId: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized.');

  // Mark conversation read
  await prisma.whatsAppConversation.update({
    where: { id: conversationId },
    data: { unreadCount: 0 },
  });

  return prisma.whatsAppMessage.findMany({
    where: { conversationId },
    orderBy: {
      createdAt: 'asc',
    },
  });
}

/**
 * Sends a WhatsApp message in a conversation thread.
 */
export async function sendWhatsAppChatMessage(conversationId: string, text: string) {
  const user = await getCurrentUser();
  if (!user) return { error: 'Unauthorized.' };

  if (!text.trim()) return { error: 'Message text cannot be empty.' };

  try {
    const conversation = await prisma.whatsAppConversation.findUnique({
      where: { id: conversationId },
      include: { customer: true },
    });

    if (!conversation) return { error: 'Conversation not found.' };

    // Check WhatsApp service window if Meta provider (optional check, warnings are sufficient for now)
    const isServiceWindowExpired = conversation.serviceWindowExpiresAt 
      ? new Date() > new Date(conversation.serviceWindowExpiresAt)
      : true;

    // Check if there is a product code or slug to attach the thumbnail image
    let product = null;
    const codeMatch = text.match(/(JWR-[A-Z]-[0-9]{2}-[0-9]{4})/i);
    const slugMatch = text.match(/\/p\/([a-zA-Z0-9_-]+)/);

    if (codeMatch) {
      product = await prisma.product.findFirst({
        where: { productCode: { equals: codeMatch[1], mode: 'insensitive' } },
        include: { images: { orderBy: { sortOrder: 'asc' }, take: 1 } },
      });
    } else if (slugMatch) {
      product = await prisma.product.findUnique({
        where: { slug: slugMatch[1] },
        include: { images: { orderBy: { sortOrder: 'asc' }, take: 1 } },
      });
    }

    const firstImage = product?.images[0]?.url;

    // Send using official/mock provider
    const res = firstImage
      ? await sendWhatsAppMessage({
          to: conversation.waId,
          type: 'image',
          image: { link: firstImage, caption: text },
        })
      : await sendWhatsAppMessage({
          to: conversation.waId,
          type: 'text',
          text: { body: text },
        });

    if (!res.success) {
      return { error: res.error || 'Failed to send message via provider.' };
    }

    // Save outbound message to DB
    const message = await prisma.whatsAppMessage.create({
      data: {
        conversationId,
        providerMessageId: res.providerMessageId,
        direction: MessageDirection.OUTBOUND,
        type: firstImage ? 'IMAGE' : 'TEXT',
        mediaUrl: firstImage || null,
        status: MessageStatus.SENT,
        body: text,
        sentAt: new Date(),
      },
    });

    // Update conversation last message timestamp
    await prisma.whatsAppConversation.update({
      where: { id: conversationId },
      data: {
        lastMessageAt: new Date(),
      },
    });

    return { success: true, message };
  } catch (error: any) {
    console.error('sendWhatsAppChatMessage action error:', error);
    return { error: error.message || 'Failed to send message.' };
  }
}

/**
 * Computes customer intelligence context (LTV, preferences, active holds, recently viewed, recommendations).
 */
export async function getCustomerContext(customerId: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized.');

  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    include: {
      orders: {
        include: {
          orderItems: {
            include: { product: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      },
      reservations: {
        where: { status: 'ACTIVE' },
        include: { product: true },
        orderBy: { reservedAt: 'desc' },
      },
      interactions: {
        include: { product: true },
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
    },
  });

  if (!customer) throw new Error('Customer not found.');

  // 1. Calculate LTV (Paid orders)
  const paidOrders = customer.orders.filter(o => o.paymentStatus === 'PAID');
  const ltv = paidOrders.reduce((sum, o) => sum + Number(o.total), 0);

  // 2. Compute Color Affinity
  const colorCounts: Record<string, number> = {};
  
  // From orders
  customer.orders.forEach(o => {
    o.orderItems.forEach(oi => {
      const col = oi.product?.primaryColour;
      if (col) colorCounts[col] = (colorCounts[col] || 0) + 2; // Weight purchases higher
    });
  });
  
  // From reservations
  customer.reservations.forEach(r => {
    const col = r.product?.primaryColour;
    if (col) colorCounts[col] = (colorCounts[col] || 0) + 1.5;
  });

  // From interactions (views/inquiries)
  customer.interactions.forEach(i => {
    const col = i.product?.primaryColour;
    if (col) colorCounts[col] = (colorCounts[col] || 0) + 0.5;
  });

  const preferredColours = Object.entries(colorCounts)
    .sort((a, b) => b[1] - a[1])
    .map(entry => entry[0])
    .slice(0, 3);

  // 3. Compute Price Range Preference
  let avgPrice = 0;
  let priceCount = 0;
  customer.orders.forEach(o => {
    o.orderItems.forEach(oi => {
      avgPrice += Number(oi.unitPrice);
      priceCount++;
    });
  });
  customer.reservations.forEach(r => {
    avgPrice += Number(r.product?.price || 0);
    priceCount++;
  });

  const averagePrice = priceCount > 0 ? avgPrice / priceCount : 0;
  const priceRangePreference = averagePrice > 0
    ? `₹${Math.max(0, Math.floor(averagePrice * 0.8)).toLocaleString('en-IN')} - ₹${Math.floor(averagePrice * 1.2).toLocaleString('en-IN')}`
    : 'No transactions yet';

  // 4. Recently viewed products (from interactions)
  const recentlyViewed = customer.interactions
    .filter(i => i.type === 'PRODUCT_VIEW' || i.type === 'WHATSAPP_INQUIRY')
    .map(i => i.product)
    .filter((p): p is NonNullable<typeof p> => !!p)
    // Deduplicate
    .filter((value, index, self) => self.findIndex(t => t.id === value.id) === index)
    .slice(0, 5);

  // 5. Smart Recommendations (available products matching customer preferred colours or category)
  // Fetch available products
  const topColor = preferredColours[0];
  const recommended = await prisma.product.findMany({
    where: {
      inventoryStatus: 'AVAILABLE',
      publishStatus: 'PUBLISHED',
      quantity: { gte: 1 },
      ...(topColor ? { primaryColour: topColor } : {}),
      // Exclude items already purchased
      orderItems: {
        none: {
          order: { customerId: customer.id },
        },
      },
    },
    take: 4,
  });

  return JSON.parse(JSON.stringify({
    customerName: customer.name,
    mobile: customer.mobile,
    normalizedMobile: customer.normalizedMobile,
    city: customer.city || 'Not specified',
    notes: customer.notes || '',
    ltv,
    orderCount: customer.orders.length,
    orders: customer.orders,
    reservations: customer.reservations,
    preferredColours: preferredColours.length > 0 ? preferredColours.join(', ') : 'None calculated',
    priceRangePreference,
    recentlyViewed,
    recommended,
  }));
}

/**
 * Assigns a salesperson to a conversation.
 */
export async function assignSalesperson(conversationId: string, userId: string | null) {
  const user = await getCurrentUser();
  if (!user) return { error: 'Unauthorized.' };

  try {
    await prisma.whatsAppConversation.update({
      where: { id: conversationId },
      data: { assignedUserId: userId },
    });
    return { success: true };
  } catch (error: any) {
    return { error: error.message || 'Failed to assign salesperson.' };
  }
}

/**
 * Invokes Gemini AI to suggest reply message options based on CRM intelligence.
 */
export async function getAISuggestedReplies(customerId: string, conversationId: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized.');

  // 1. Fetch last inbound message body
  const lastInbound = await prisma.whatsAppMessage.findFirst({
    where: { conversationId, direction: MessageDirection.INBOUND },
    orderBy: { createdAt: 'desc' },
  });

  // 2. Fetch context details
  const ctx = await getCustomerContext(customerId);

  // 3. Generate suggestions via Gemini/Mock
  const suggestions = await generateSuggestedReplies(
    {
      customerName: ctx.customerName,
      preferredColours: ctx.preferredColours,
      priceRangePreference: ctx.priceRangePreference,
      reservations: ctx.reservations,
      recommended: ctx.recommended,
    },
    lastInbound?.body || ''
  );

  return suggestions;
}
