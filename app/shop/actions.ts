'use server';

import { prisma } from '@/lib/prisma';
import { sendWhatsAppMessage } from '@/lib/integrations/whatsapp/provider';
import { normalizePhoneNumber } from '@/lib/phone';
import { findCustomerByLoginIdentifier } from '@/lib/customerLookup';
import { setCustomerSession, getCurrentCustomer } from '@/lib/clientAuth';
import { createPaymentLink } from '@/lib/integrations/payments/provider';
import { emitBusinessEvent } from '@/lib/domain/automation';
import { revalidatePath } from 'next/cache';
import { Prisma, MessageDirection, MessageStatus, OrderStatus } from '@prisma/client';
import Razorpay from 'razorpay';
import {
  DEFAULT_CUSTOMER_PASSWORD,
  hashCustomerPassword,
  verifyCustomerPassword,
} from '@/lib/security/customerPassword';

type CheckoutCustomer = {
  id: string;
  name: string;
  email: string;
  mobile: string | null;
  normalizedMobile: string | null;
};

const PAYMENT_WINDOW_MINUTES = 120;

type CheckoutFields = {
  orderId: string;
  razorpayOrderId: string;
  amount: number;
  currency: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerMobile: string;
  paymentUrl: string;
};
type Absent<T> = { [K in keyof T]?: undefined };

/** Result of starting checkout: Razorpay popup, hosted payment link, or error. */
type CheckoutStartResult =
  | ({ success: true; useStandardCheckout: true; error?: undefined } &
      Omit<CheckoutFields, 'paymentUrl'> & Absent<Pick<CheckoutFields, 'paymentUrl'>>)
  | ({ success: true; useStandardCheckout?: undefined; error?: undefined } &
      Pick<CheckoutFields, 'orderId'> & { paymentUrl?: string } &
      Absent<Omit<CheckoutFields, 'orderId' | 'paymentUrl'>>)
  | ({ error: string; success?: undefined; useStandardCheckout?: undefined } & Absent<CheckoutFields>);

/**
 * Finds this customer's still-unpaid order for exactly the given products, so
 * retrying checkout (e.g. after closing the Razorpay popup) reuses it instead
 * of creating a duplicate order each time.
 */
async function findReusableUnpaidOrder(
  db: Pick<typeof prisma, 'order'>,
  customerId: string,
  productIds: string[]
) {
  const candidates = await db.order.findMany({
    where: {
      customerId,
      paymentStatus: 'UNPAID',
      status: OrderStatus.PENDING,
      orderItems: { some: { productId: { in: productIds } } },
    },
    include: { orderItems: { select: { productId: true } } },
    orderBy: { createdAt: 'desc' },
  });
  const wanted = [...productIds].sort().join(',');
  return (
    candidates.find(
      (o) => o.orderItems.map((i) => i.productId).sort().join(',') === wanted
    ) ?? null
  );
}

/**
 * Starts (or resumes) payment for an order: reuses an unexpired Razorpay order
 * or payment link for it when one exists, otherwise creates a new one.
 */
async function startOrderPayment(
  order: { id: string; orderNumber: string; total: Prisma.Decimal },
  customer: CheckoutCustomer
): Promise<CheckoutStartResult> {
  const provider = process.env.PAYMENT_PROVIDER || 'mock';
  const amount = Number(order.total);
  const customerMobile = customer.normalizedMobile || customer.mobile || '';

  const existing = await prisma.paymentRequest.findFirst({
    where: {
      orderId: order.id,
      status: 'CREATED',
      expiresAt: { gt: new Date() },
      providerPaymentLinkId: { not: null },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (provider === 'razorpay') {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) {
      return { error: 'Razorpay configuration error.' };
    }

    // Standard checkout requests have no short URL; Razorpay lets the same
    // order be retried until it is paid.
    let razorpayOrderId = existing && !existing.shortUrl ? existing.providerPaymentLinkId! : null;
    if (!razorpayOrderId) {
      const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });
      const rzpOrder = await razorpay.orders.create({
        amount: Math.round(amount * 100),
        currency: 'INR',
        receipt: order.orderNumber,
      });
      razorpayOrderId = rzpOrder.id;
      await prisma.paymentRequest.create({
        data: {
          orderId: order.id,
          provider: 'RAZORPAY',
          providerPaymentLinkId: rzpOrder.id,
          shortUrl: '',
          amount: order.total,
          status: 'CREATED',
          expiresAt: new Date(Date.now() + PAYMENT_WINDOW_MINUTES * 60 * 1000),
        },
      });
    }

    revalidatePath('/', 'layout');
    return {
      success: true as const,
      useStandardCheckout: true as const,
      orderId: order.id,
      razorpayOrderId: razorpayOrderId!,
      amount: Math.round(amount * 100),
      currency: 'INR',
      orderNumber: order.orderNumber,
      customerName: customer.name,
      customerEmail: customer.email || '',
      customerMobile,
    };
  }

  if (existing?.shortUrl) {
    return { success: true as const, paymentUrl: existing.shortUrl, orderId: order.id };
  }

  const res = await createPaymentLink({
    orderId: order.id,
    orderNumber: order.orderNumber,
    amount,
    customerName: customer.name,
    customerMobile,
    customerEmail: customer.email || undefined,
    expiresInMinutes: PAYMENT_WINDOW_MINUTES,
  });

  if (!res.success) {
    return { error: res.error || 'Failed to generate checkout payment link.' };
  }

  await prisma.paymentRequest.create({
    data: {
      orderId: order.id,
      provider: 'RAZORPAY',
      providerPaymentLinkId: res.providerPaymentLinkId || '',
      shortUrl: res.shortUrl || '',
      amount: order.total,
      status: 'CREATED',
      expiresAt: new Date(Date.now() + PAYMENT_WINDOW_MINUTES * 60 * 1000),
    },
  });

  revalidatePath('/', 'layout');
  return { success: true as const, paymentUrl: res.shortUrl, orderId: order.id };
}

/** Customer fields that are safe to return to the browser. */
function toPublicCustomer(customer: {
  id: string;
  name: string;
  email: string;
  mobile: string | null;
  normalizedMobile: string | null;
  city: string | null;
}) {
  return {
    id: customer.id,
    name: customer.name,
    email: customer.email,
    mobile: customer.mobile,
    normalizedMobile: customer.normalizedMobile,
    city: customer.city,
  };
}

/**
 * Authenticates a client using their email or mobile number and password.
 * Customers created from WhatsApp only know their phone number, so both work.
 */
export async function clientLoginAction(data: {
  email: string;
  password: string;
}) {
  const identifier = data.email.trim();
  if (!identifier || !data.password.trim()) {
    return { error: 'Email or mobile number, and password, are required.' };
  }

  try {
    const customer = await findCustomerByLoginIdentifier(identifier);

    if (!customer) {
      return { error: 'Invalid email/mobile number or password.' };
    }

    const attempt = data.password.trim();
    const { valid, needsRehash } = await verifyCustomerPassword(attempt, customer.password);
    if (!valid) {
      return { error: 'Invalid email/mobile number or password.' };
    }

    // Upgrade legacy plaintext passwords to a hash on successful login
    if (needsRehash) {
      await prisma.customer.update({
        where: { id: customer.id },
        data: { password: await hashCustomerPassword(attempt) },
      });
    }

    // Start Customer session cookie
    await setCustomerSession({
      id: customer.id,
      email: customer.email,
      name: customer.name,
    });

    return { 
      success: true, 
      mustChangePassword: attempt === DEFAULT_CUSTOMER_PASSWORD,
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
  const password = data.password?.trim() || DEFAULT_CUSTOMER_PASSWORD;
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
        password: await hashCustomerPassword(password),
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

    return { success: true, customer: toPublicCustomer(customer) };
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

  if (data.newPassword.trim() === DEFAULT_CUSTOMER_PASSWORD) {
    return { error: 'You cannot change your password back to the default password.' };
  }

  try {
    const { password: storedPassword } = await prisma.customer.findUniqueOrThrow({
      where: { id: customer.id },
      select: { password: true },
    });
    const { valid } = await verifyCustomerPassword(data.oldPassword.trim(), storedPassword);
    if (!valid) {
      return { error: 'Incorrect current password.' };
    }

    await prisma.customer.update({
      where: { id: customer.id },
      data: { password: await hashCustomerPassword(data.newPassword.trim()) },
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

      // Already held by this customer (e.g. retrying Buy Now): reuse the hold
      const ownHold = await tx.reservation.findFirst({
        where: {
          productId,
          customerId: customer.id,
          status: 'ACTIVE',
          expiresAt: { gt: new Date() },
        },
        orderBy: { reservedAt: 'desc' },
      });
      if (ownHold) {
        return { reservation: ownHold, reused: true };
      }

      if (product.inventoryStatus !== 'AVAILABLE' || product.quantity <= 0) {
        throw new Error('This piece is no longer available.');
      }

      // 2. Fetch reservation hold duration setting
      const holdSetting = await tx.systemSetting.findUnique({
        where: { key: 'reservationHoldMinutes' },
      });
      const holdMinutes = parseInt(holdSetting?.value || '20', 10);
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

      return { reservation, reused: false };
    });

    if (!result.reused) {
      // Emit business event for reservation creation asynchronously in background (instant UI response)
      emitBusinessEvent('RESERVATION_CREATED', {
        reservationId: result.reservation.id,
        productId,
        customerId: customer.id,
      }).catch((err) => {
        console.error('Failed to emit RESERVATION_CREATED event:', err);
      });
    }

    revalidatePath('/', 'layout');
    return { success: true, reservation: result.reservation, alreadyHeld: result.reused };
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

      // 3. Delete any pending unpaid orders for this customer and product
      const pendingOrders = await tx.order.findMany({
        where: {
          customerId: customer.id,
          paymentStatus: 'UNPAID',
          status: 'PENDING',
          orderItems: {
            some: {
              productId: reservation.productId,
            },
          },
        },
      });

      for (const order of pendingOrders) {
        // A. Delete related transactions
        await tx.paymentTransaction.deleteMany({
          where: { orderId: order.id },
        });
        // B. Delete related payments (payment requests)
        await tx.paymentRequest.deleteMany({
          where: { orderId: order.id },
        });
        // C. Delete related order items
        await tx.orderItem.deleteMany({
          where: { orderId: order.id },
        });
        // D. Delete related shipments
        await tx.shipment.deleteMany({
          where: { orderId: order.id },
        });
        // E. Finally delete order
        await tx.order.delete({
          where: { id: order.id },
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

    revalidatePath('/', 'layout');
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
        ...(conversation.status === 'ARCHIVED' ? { status: 'OPEN' } : {}),
        lastMessageAt: new Date(),
        unreadCount: { increment: 1 },
      },
    });

    revalidatePath('/', 'layout');
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

/**
 * Initiates the checkout payment process for a reserved product.
 */
export async function clientCheckoutAction(data: { reservationId: string; notes?: string }): Promise<CheckoutStartResult> {
  const customer = await getCurrentCustomer();
  if (!customer) {
    return { error: 'Authentication required. Please log in first.' };
  }

  try {
    // 1. Fetch active reservation
    const reservation = await prisma.reservation.findUnique({
      where: { id: data.reservationId },
      include: { product: true },
    });

    if (!reservation || reservation.status !== 'ACTIVE') {
      return { error: 'Reservation hold is no longer active.' };
    }

    if (reservation.customerId !== customer.id) {
      return { error: 'Unauthorized.' };
    }

    // 2. Reuse this customer's unpaid order for the piece, or create one
    let order = await findReusableUnpaidOrder(prisma, customer.id, [reservation.productId]);

    if (order) {
      if (data.notes && data.notes !== order.notes) {
        order = await prisma.order.update({
          where: { id: order.id },
          data: { notes: data.notes },
          include: { orderItems: { select: { productId: true } } },
        });
      }
    } else {
      const count = await prisma.order.count();
      const orderNumber = `JWR-ORD-${(count + 1).toString().padStart(4, '0')}`;

      order = await prisma.order.create({
        data: {
          customerId: customer.id,
          orderNumber,
          subtotal: reservation.product.price,
          total: reservation.product.price,
          status: OrderStatus.PENDING,
          paymentStatus: 'UNPAID',
          notes: data.notes || null,
          orderItems: {
            create: {
              productId: reservation.productId,
              quantity: 1,
              unitPrice: reservation.product.price,
              finalPrice: reservation.product.price,
            },
          },
        },
        include: { orderItems: { select: { productId: true } } },
      });

      try {
        await emitBusinessEvent('ORDER_CREATED', { orderId: order.id });
      } catch (e) {
        console.error('Failed to emit ORDER_CREATED in clientCheckoutAction:', e);
      }
    }

    // 3. Start (or resume) payment
    return await startOrderPayment(order, customer);
  } catch (error: any) {
    console.error('clientCheckoutAction error:', error);
    let errorMsg = 'Failed to create order checkout.';
    if (error) {
      if (typeof error === 'string') {
        errorMsg = error;
      } else if (error.error && typeof error.error === 'object' && error.error.description) {
        errorMsg = error.error.description;
      } else if (error.message) {
        errorMsg = error.message;
      } else {
        try {
          errorMsg = JSON.stringify(error);
        } catch (_) {
          errorMsg = String(error);
        }
      }
    }
    return { error: errorMsg };
  }
}

/**
 * Initiates the checkout payment process for a list of products in the cart.
 */
export async function clientCartCheckoutAction(data: { items: { productId: string; quantity: number }[]; notes?: string }): Promise<CheckoutStartResult> {
  const customer = await getCurrentCustomer();
  if (!customer) {
    return { error: 'Authentication required. Please log in first.' };
  }

  if (!data.items || data.items.length === 0) {
    return { error: 'Cart is empty.' };
  }

  const productIds = data.items.map(item => item.productId);

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Fetch and validate all products
      const products = await tx.product.findMany({
        where: { id: { in: productIds } },
      });

      if (products.length !== productIds.length) {
        throw new Error('Some products in your cart could not be found.');
      }

      // Map for quick product lookup
      const productsMap = new Map(products.map(p => [p.id, p]));

      // Pieces this customer already holds (e.g. from an earlier checkout
      // attempt) count as theirs rather than "reserved by another customer".
      const ownHolds = await tx.reservation.findMany({
        where: {
          customerId: customer.id,
          productId: { in: productIds },
          status: 'ACTIVE',
          expiresAt: { gt: new Date() },
        },
      });
      const ownHoldQty = new Map<string, number>();
      for (const hold of ownHolds) {
        ownHoldQty.set(hold.productId, (ownHoldQty.get(hold.productId) || 0) + hold.quantity);
      }
      const isHeldByCustomer = (productId: string, quantity: number) =>
        (ownHoldQty.get(productId) || 0) >= quantity;

      // Check availability of each product
      for (const item of data.items) {
        const product = productsMap.get(item.productId);
        if (!product) {
          throw new Error('Product not found.');
        }

        if (product.publishStatus === 'PUBLISHED' && isHeldByCustomer(item.productId, item.quantity)) {
          continue;
        }

        if (product.publishStatus !== 'PUBLISHED') {
          throw new Error(`Product "${product.name}" is not available in the public catalog.`);
        }

        if (product.isUnique) {
          if (item.quantity > 1) {
            throw new Error(`Product "${product.name}" is unique and only 1 can be purchased.`);
          }
          if (product.inventoryStatus !== 'AVAILABLE') {
            throw new Error(`Product "${product.name}" is no longer available.`);
          }
        } else {
          if (product.quantity < item.quantity) {
            throw new Error(`Product "${product.name}" only has ${product.quantity} units available.`);
          }
        }
      }

      // 2. Fetch reservation hold duration setting
      const holdSetting = await tx.systemSetting.findUnique({
        where: { key: 'reservationHoldMinutes' },
      });
      const holdMinutes = parseInt(holdSetting?.value || '20', 10);
      const expiresAt = new Date(Date.now() + holdMinutes * 60 * 1000);

      // 3. Atomically update product inventory and create reservations
      for (const item of data.items) {
        const product = productsMap.get(item.productId)!;

        if (isHeldByCustomer(item.productId, item.quantity)) {
          continue;
        }

        if (product.isUnique) {
          const updateResult = await tx.product.updateMany({
            where: {
              id: product.id,
              inventoryStatus: 'AVAILABLE',
              isUnique: true,
            },
            data: {
              inventoryStatus: 'RESERVED',
            },
          });

          if (updateResult.count === 0) {
            throw new Error(`Product "${product.name}" was just reserved by another customer.`);
          }
        } else {
          const updateResult = await tx.product.updateMany({
            where: {
              id: product.id,
              isUnique: false,
              quantity: { gte: item.quantity },
            },
            data: {
              quantity: { decrement: item.quantity },
            },
          });

          if (updateResult.count === 0) {
            throw new Error(`Product "${product.name}" does not have enough stock.`);
          }
        }

        // Create reservation structure
        await tx.reservation.create({
          data: {
            productId: product.id,
            customerId: customer.id,
            reservedBy: `${customer.name} (Website Cart)`,
            status: 'ACTIVE',
            expiresAt,
            quantity: item.quantity,
          },
        });

        // Log Customer Interaction
        await tx.customerInteraction.create({
          data: {
            customerId: customer.id,
            productId: product.id,
            type: 'RESERVED',
            metadata: { channel: 'CLIENT_PORTAL_CART', durationMinutes: holdMinutes, quantity: item.quantity },
          },
        });
      }

      // 4. Reuse this customer's unpaid order for the same items, or create one
      const reusable = await findReusableUnpaidOrder(tx, customer.id, productIds);
      if (reusable) {
        const order = await tx.order.update({
          where: { id: reusable.id },
          data: data.notes ? { notes: data.notes } : {},
        });
        return { order, totalAmount: Number(order.total), isNew: false };
      }

      const count = await tx.order.count();
      const orderNumber = `JWR-ORD-${(count + 1).toString().padStart(4, '0')}`;
      const totalAmount = data.items.reduce((sum, item) => {
        const product = productsMap.get(item.productId)!;
        return sum + Number(product.price) * item.quantity;
      }, 0);

      const order = await tx.order.create({
        data: {
          customerId: customer.id,
          orderNumber,
          subtotal: new Prisma.Decimal(totalAmount),
          total: new Prisma.Decimal(totalAmount),
          status: OrderStatus.PENDING,
          paymentStatus: 'UNPAID',
          notes: data.notes || null,
          orderItems: {
            create: data.items.map((item) => {
              const product = productsMap.get(item.productId)!;
              return {
                productId: product.id,
                quantity: item.quantity,
                unitPrice: product.price,
                finalPrice: new Prisma.Decimal(Number(product.price) * item.quantity),
              };
            }),
          },
        },
      });

      return { order, totalAmount, isNew: true };
    });

    const { order, isNew } = result;

    if (isNew) {
      try {
        await emitBusinessEvent('ORDER_CREATED', { orderId: order.id });
      } catch (e) {
        console.error('Failed to emit ORDER_CREATED in clientCartCheckoutAction:', e);
      }
    }

    return await startOrderPayment(order, customer);
  } catch (error: any) {
    console.error('clientCartCheckoutAction error:', error);
    return { error: error.message || 'Failed to complete cart checkout.' };
  }
}

/**
 * Registers a guest customer and starts a customer session.
 */
export async function clientGuestRegisterAction(data: {
  firstName: string;
  lastName: string;
  email: string;
  mobile: string;
  city?: string;
  address?: string;
}) {
  if (!data.firstName.trim() || !data.lastName.trim() || !data.email.trim() || !data.mobile.trim()) {
    return { error: 'First name, last name, email, and mobile phone number are all required.' };
  }

  const emailLower = data.email.toLowerCase().trim();
  const fullName = `${data.firstName.trim()} ${data.lastName.trim()}`;

  let normalized: string;
  try {
    normalized = normalizePhoneNumber(data.mobile);
  } catch (err) {
    return { error: 'Invalid mobile phone number format.' };
  }

  try {
    // Never attach a guest to an existing account: that would let anyone who
    // knows a customer's email or phone sign in as them without a password.
    const existing = await prisma.customer.findFirst({
      where: {
        OR: [{ email: emailLower }, { normalizedMobile: normalized }],
      },
      select: { id: true },
    });
    if (existing) {
      return {
        error: 'An account already exists with this email or mobile number. Please sign in to continue.',
        requiresLogin: true,
      };
    }

    const customer = await prisma.customer.create({
      data: {
        name: fullName,
        email: emailLower,
        mobile: data.mobile.trim(),
        normalizedMobile: normalized,
        password: await hashCustomerPassword(DEFAULT_CUSTOMER_PASSWORD),
        city: data.city?.trim() || null,
        source: 'WEBSITE',
        notes: data.address?.trim() ? `Guest Checkout Address: ${data.address.trim()}` : null,
      },
    });

    // Start Customer session cookie
    await setCustomerSession({
      id: customer.id,
      email: customer.email,
      name: customer.name,
    });

    return { success: true, customer: toPublicCustomer(customer) };
  } catch (error: any) {
    console.error('clientGuestRegisterAction error:', error);
    return { error: error.message || 'Failed to register guest details.' };
  }
}

