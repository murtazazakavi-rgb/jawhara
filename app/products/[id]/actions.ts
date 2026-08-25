'use server';

import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { generateOrderNumber } from '@/lib/domain/inventory';
import { Prisma } from '@prisma/client';
import { createPaymentLink } from '@/lib/integrations/payments/provider';
import { sendWhatsAppChatMessage } from '@/app/whatsapp/actions';

export async function createReservation({
  productId,
  customerId,
  notes,
  expiresAtStr,
  quantity = 1,
}: {
  productId: string;
  customerId: string;
  notes?: string;
  expiresAtStr?: string;
  quantity?: number;
}) {
  const user = await getCurrentUser();
  if (!user) {
    return { error: 'Unauthorized.' };
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Fetch product
      const product = await tx.product.findUnique({
        where: { id: productId },
      });

      if (!product || product.publishStatus !== 'PUBLISHED') {
        throw new Error('Product is not available for reservation.');
      }

      const reqQty = product.isUnique ? 1 : quantity;

      if (product.isUnique) {
        // Concurrency-safe atomic check & update
        const updateResult = await tx.product.updateMany({
          where: {
            id: productId,
            inventoryStatus: 'AVAILABLE',
            publishStatus: 'PUBLISHED',
            isUnique: true,
          },
          data: {
            inventoryStatus: 'RESERVED',
          },
        });

        if (updateResult.count === 0) {
          throw new Error('This unique piece is already reserved or sold.');
        }
      } else {
        // Quantity-based atomic check & update
        const updateResult = await tx.product.updateMany({
          where: {
            id: productId,
            publishStatus: 'PUBLISHED',
            isUnique: false,
            quantity: { gte: reqQty },
          },
          data: {
            quantity: { decrement: reqQty },
          },
        });

        if (updateResult.count === 0) {
          throw new Error('Insufficient inventory available for this product.');
        }
      }

      // 2. Create Reservation record
      const expiresAt = expiresAtStr ? new Date(expiresAtStr) : null;
      const reservation = await tx.reservation.create({
        data: {
          productId,
          customerId,
          reservedBy: user.name,
          notes,
          expiresAt,
          status: 'ACTIVE',
          quantity: reqQty,
        },
      });

      // Insert CustomerInteraction
      await tx.customerInteraction.create({
        data: {
          customerId,
          productId,
          type: 'RESERVED',
          metadata: { reservedBy: user.name, quantity: reqQty },
        },
      });

      // 3. Log Activity
      await tx.activityLog.create({
        data: {
          entityType: 'RESERVATION',
          entityId: reservation.id,
          action: 'CREATED',
          userId: user.id,
          metadata: JSON.stringify({ productId, customerId, notes, quantity: reqQty }),
        },
      });

      return reservation;
    });

    revalidatePath(`/products/${productId}`);
    return { success: true, reservation: result };
  } catch (e: any) {
    return { error: e.message || 'Failed to create reservation.' };
  }
}

// Release Reservation
export async function releaseReservation({ productId }: { productId: string }) {
  const user = await getCurrentUser();
  if (!user) {
    return { error: 'Unauthorized.' };
  }

  try {
    await prisma.$transaction(async (tx) => {
      // Find active reservation
      const activeRes = await tx.reservation.findFirst({
        where: { productId, status: 'ACTIVE' },
        include: { product: true },
      });

      if (!activeRes) {
        throw new Error('No active reservation found.');
      }

      // 1. Update reservation status
      await tx.reservation.update({
        where: { id: activeRes.id },
        data: {
          status: 'RELEASED',
          releasedAt: new Date(),
        },
      });

      // Insert CustomerInteraction
      await tx.customerInteraction.create({
        data: {
          customerId: activeRes.customerId,
          productId: activeRes.productId,
          type: 'RESERVATION_RELEASED',
          metadata: { releasedBy: user.name },
        },
      });

      // 2. Revert inventory
      if (activeRes.product.isUnique) {
        await tx.product.update({
          where: { id: productId },
          data: {
            inventoryStatus: 'AVAILABLE',
          },
        });
      } else {
        await tx.product.update({
          where: { id: productId },
          data: {
            quantity: { increment: activeRes.quantity },
          },
        });
      }

      // 3. Log Activity
      await tx.activityLog.create({
        data: {
          entityType: 'RESERVATION',
          entityId: activeRes.id,
          action: 'RELEASED',
          userId: user.id,
          metadata: JSON.stringify({ productId }),
        },
      });
    });

    revalidatePath(`/products/${productId}`);
    return { success: true };
  } catch (e: any) {
    return { error: e.message || 'Failed to release reservation.' };
  }
}

// Mark Product Sold (Create Order transaction)
export async function markProductSold({
  productId,
  customerId,
  price,
  paymentStatus,
  notes,
  quantity = 1,
}: {
  productId: string;
  customerId: string;
  price: number;
  paymentStatus: 'PAID' | 'UNPAID';
  notes?: string;
  quantity?: number;
}) {
  const user = await getCurrentUser();
  if (!user) {
    return { error: 'Unauthorized.' };
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Fetch product
      const product = await tx.product.findUnique({
        where: { id: productId },
      });

      if (!product) {
        throw new Error('Product not found.');
      }

      const reqQty = product.isUnique ? 1 : quantity;

      if (product.isUnique && product.inventoryStatus === 'SOLD') {
        throw new Error('This unique piece has already been sold.');
      }

      // Check if reserved. If reserved by someone else, block.
      const activeRes = await tx.reservation.findFirst({
        where: { productId, status: 'ACTIVE' },
      });

      if (activeRes && activeRes.customerId !== customerId) {
        throw new Error('This product is reserved by another customer.');
      }

      // 2. Close active reservation if any
      if (activeRes) {
        await tx.reservation.update({
          where: { id: activeRes.id },
          data: {
            status: 'SOLD',
            releasedAt: new Date(),
            convertedToOrderAt: new Date(),
          },
        });
      }

      // 3. Generate Order number sequence
      const orderNumber = await generateOrderNumber(tx);

      // 4. Create Order and OrderItem
      const order = await tx.order.create({
        data: {
          orderNumber,
          customerId,
          status: 'PENDING',
          paymentStatus: paymentStatus === 'PAID' ? 'PAID' : 'UNPAID',
          subtotal: new Prisma.Decimal(price),
          total: new Prisma.Decimal(price),
          currency: 'INR',
          notes,
          salespersonId: user.id,
          orderItems: {
            create: {
              productId,
              quantity: reqQty,
              unitPrice: new Prisma.Decimal(price),
              finalPrice: new Prisma.Decimal(price),
            },
          },
        },
      });

      // Insert CustomerInteraction
      await tx.customerInteraction.create({
        data: {
          customerId,
          productId,
          type: 'PURCHASED',
          metadata: { price, orderId: order.id, orderNumber },
        },
      });

      // 5. Update Product status/inventory
      if (product.isUnique) {
        await tx.product.update({
          where: { id: productId },
          data: {
            inventoryStatus: 'SOLD',
            soldAt: new Date(),
            quantity: 0,
          },
        });
      } else {
        // If it was already reserved, the quantity was decremented during reservation creation.
        // If it was NOT reserved (direct sale), we must decrement it now.
        if (!activeRes) {
          const updateResult = await tx.product.updateMany({
            where: {
              id: productId,
              isUnique: false,
              quantity: { gte: reqQty },
            },
            data: {
              quantity: { decrement: reqQty },
            },
          });
          if (updateResult.count === 0) {
            throw new Error('Insufficient inventory available to sell.');
          }
        }
      }

      // 6. Log Activity
      await tx.activityLog.create({
        data: {
          entityType: 'ORDER',
          entityId: order.id,
          action: 'CREATED',
          userId: user.id,
          metadata: JSON.stringify({ productId, customerId, price, paymentStatus, quantity: reqQty }),
        },
      });

      return order;
    });

    revalidatePath(`/products/${productId}`);
    return { success: true, order: result };
  } catch (e: any) {
    return { error: e.message || 'Failed to complete transaction.' };
  }
}

/**
 * Creates a Razorpay Payment Link for an Order and sends it via WhatsApp.
 */
export async function createPaymentRequestAction({
  orderId,
  expiresInMinutes = 120,
}: {
  orderId: string;
  expiresInMinutes?: number;
}) {
  const user = await getCurrentUser();
  if (!user) return { error: 'Unauthorized.' };

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Fetch order
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: { 
          customer: true, 
          orderItems: { include: { product: true } } 
        },
      });

      if (!order) throw new Error('Order not found.');
      if (order.paymentStatus === 'PAID') throw new Error('Order is already paid.');

      // 2. Validate reservations
      for (const item of order.orderItems) {
        if (item.product.isUnique) {
          const activeRes = await tx.reservation.findFirst({
            where: { productId: item.productId, status: 'ACTIVE' },
          });
          if (activeRes && activeRes.customerId !== order.customerId) {
            throw new Error(`Product ${item.product.name} is reserved by another customer.`);
          }
        }
      }

      // 3. Create Payment Link via Provider
      const holdTimeMinutes = Number(expiresInMinutes);
      const res = await createPaymentLink({
        orderId: order.id,
        orderNumber: order.orderNumber,
        amount: Number(order.total),
        customerName: order.customer.name,
        customerMobile: order.customer.normalizedMobile || order.customer.mobile || '',
        customerEmail: order.customer.email || undefined,
        expiresInMinutes: holdTimeMinutes,
      });

      if (!res.success) {
        throw new Error(res.error || 'Failed to create payment link.');
      }

      // 4. Store PaymentRequest record
      const expiresAt = new Date(Date.now() + holdTimeMinutes * 60 * 1000);
      const paymentRequest = await tx.paymentRequest.create({
        data: {
          orderId: order.id,
          provider: 'RAZORPAY',
          providerPaymentLinkId: res.providerPaymentLinkId,
          shortUrl: res.shortUrl,
          amount: order.total,
          status: 'CREATED',
          expiresAt,
        },
      });

      // 5. Log Activity
      await tx.activityLog.create({
        data: {
          entityType: 'ORDER',
          entityId: order.id,
          action: 'PAYMENT_LINK_CREATED',
          userId: user.id,
          metadata: JSON.stringify({ paymentRequestId: paymentRequest.id, shortUrl: res.shortUrl }),
        },
      });

      return paymentRequest;
    });

    // 6. Send the payment link via WhatsApp immediately
    const updatedRequest = await prisma.paymentRequest.findUnique({
      where: { id: result.id },
      include: { order: { include: { customer: true } } },
    });

    if (updatedRequest) {
      const customer = updatedRequest.order.customer;
      const waId = customer.normalizedMobile;
      if (waId) {
        const amountStr = Number(updatedRequest.amount).toLocaleString('en-IN');
        const text = `Dear ${customer.name}, here is the payment link for your order ${updatedRequest.order.orderNumber} of amount ₹${amountStr}: ${updatedRequest.shortUrl}\nLink expires in ${expiresInMinutes} minutes.`;

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

        const sendRes = await sendWhatsAppChatMessage(conversation.id, text);
        if (sendRes.error) {
          console.error('Failed to send payment link WhatsApp:', sendRes.error);
        }
      }
    }

    return { success: true, paymentRequest: result };
  } catch (error: any) {
    console.error('createPaymentRequestAction error:', error);
    return { error: error.message || 'Failed to request payment.' };
  }
}

/**
 * Toggles a product's publish status (e.g. between DRAFT, PUBLISHED, ARCHIVED).
 */
export async function toggleProductPublishStatusAction(
  productId: string,
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'OWNER' && user.role !== 'ADMIN') {
    return { error: 'Unauthorized.' };
  }

  try {
    await prisma.product.update({
      where: { id: productId },
      data: { publishStatus: status },
    });

    // Log Activity
    await prisma.activityLog.create({
      data: {
        entityType: 'PRODUCT',
        entityId: productId,
        action: 'UPDATED',
        userId: user.id,
        metadata: JSON.stringify({ publishStatus: status }),
      },
    });

    revalidatePath(`/products/${productId}`);
    revalidatePath('/products');
    revalidatePath('/shop');
    return { success: true };
  } catch (error: any) {
    return { error: error.message || 'Failed to update publish status.' };
  }
}

/**
 * Cleanly deletes a product, checking for order history first.
 */
export async function deleteProductAction(productId: string) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'OWNER' && user.role !== 'ADMIN') {
    return { error: 'Unauthorized.' };
  }

  try {
    // Check if the product is linked to any order history (financial records)
    const orderItemCount = await prisma.orderItem.count({
      where: { productId },
    });

    if (orderItemCount > 0) {
      // Cannot hard delete. Must archive instead.
      await prisma.product.update({
        where: { id: productId },
        data: { publishStatus: 'ARCHIVED' },
      });

      // Log Activity
      await prisma.activityLog.create({
        data: {
          entityType: 'PRODUCT',
          entityId: productId,
          action: 'ARCHIVED',
          userId: user.id,
          metadata: JSON.stringify({ reason: 'Has order items' }),
        },
      });

      revalidatePath(`/products/${productId}`);
      revalidatePath('/products');
      revalidatePath('/shop');
      return { success: true, archived: true };
    }

    // Clean delete cascading associations
    await prisma.$transaction(async (tx) => {
      // 1. Delete product images
      await tx.productImage.deleteMany({ where: { productId } });

      // 2. Delete customer interactions
      await tx.customerInteraction.deleteMany({ where: { productId } });

      // 3. Delete reservations
      await tx.reservation.deleteMany({ where: { productId } });

      // 4. Delete product attributes values
      await tx.productAttributeValue.deleteMany({ where: { productId } });

      // 5. Finally, delete the product itself
      await tx.product.delete({ where: { id: productId } });
    });

    // Log Activity
    await prisma.activityLog.create({
      data: {
        entityType: 'PRODUCT',
        entityId: productId,
        action: 'DELETED',
        userId: user.id,
        metadata: JSON.stringify({ hardDeleted: true }),
      },
    });

    revalidatePath('/products');
    revalidatePath('/shop');
    return { success: true, hardDeleted: true };
  } catch (error: any) {
    return { error: error.message || 'Failed to delete product.' };
  }
}
