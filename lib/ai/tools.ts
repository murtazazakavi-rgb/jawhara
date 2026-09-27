/**
 * lib/ai/tools.ts
 *
 * Controlled server-side tools exposed to the Jawhara AI.
 *
 * SECURITY PRINCIPLE: The AI (LLM) never has direct database access.
 * It calls only these named functions, which return sanitized, scoped data.
 *
 * - No raw SQL is passed to the LLM
 * - Customer PII (passwords, raw payment data) is never included in tool results
 * - Tool results contain only what is needed for the AI to be helpful
 * - All tools log to AIExecution for audit
 */

import { prisma } from '@/lib/prisma';

// ─── Tool Result Types ────────────────────────────────────────────────────────

export interface CustomerProfileResult {
  id: string;
  name: string;
  city?: string;
  source?: string;
  whatsappOptIn: boolean;
  totalOrders: number;
  totalSpend: number;
  lastOrderDate?: string;
  preferredColours: string[];
  interactionCount: number;
  activeReservations: number;
  outstandingAmount: number;
}

export interface OrderSummaryResult {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  total: number;
  customerName: string;
  createdAt: string;
  itemCount: number;
}

export interface ProductMatchResult {
  id: string;
  productCode: string;
  name: string;
  price: number;
  primaryColour?: string;
  inventoryStatus: string;
  category: string;
  matchReason: string; // human-readable explanation, not fake percentages
}

export interface TodaySummaryResult {
  followUpCustomers: number;
  expiringReservations: number;
  outstandingPaymentsTotal: number;
  outstandingPaymentsCount: number;
  productsNeedingDescriptions: number;
  ordersReadyForPickup: number;
  ordersInTransit: number;
  deliveryExceptions: number;
  pendingApprovals: number;
}

// ─── Tools ───────────────────────────────────────────────────────────────────

/**
 * Returns a safe customer profile summary for AI context.
 * Never includes password, rawPassword, or financial secrets.
 */
export async function getCustomerProfile(
  customerId: string
): Promise<CustomerProfileResult | null> {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    include: {
      orders: {
        include: {
          payments: {
            where: { status: { in: ['CREATED', 'SENT', 'PARTIALLY_PAID'] } },
            select: { id: true, amount: true, status: true },
          },
        },
        select: {
          total: true,
          createdAt: true,
          paymentStatus: true,
          payments: true,
        },
        orderBy: { createdAt: 'desc' },
      },
      reservations: {
        where: { status: 'ACTIVE' },
        select: { id: true },
      },
      interactions: {
        select: { type: true, metadata: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 20,
      },
    },
  });

  if (!customer) return null;

  // Extract colour preferences from interactions
  const colourMentions: string[] = [];
  for (const interaction of customer.interactions) {
    const meta = interaction.metadata as Record<string, unknown> | null;
    if (meta?.colours) {
      const cols = Array.isArray(meta.colours) ? meta.colours : [meta.colours];
      colourMentions.push(...cols.map(String));
    }
    if (meta?.primaryColour) colourMentions.push(String(meta.primaryColour));
  }
  const uniqueColours = [...new Set(colourMentions)].slice(0, 5);

  const paidOrders = customer.orders.filter((o) => o.paymentStatus === 'PAID');
  const totalSpend = paidOrders.reduce((sum, o) => sum + Number(o.total), 0);

  // Outstanding = orders with active payment requests
  const outstandingAmount = customer.orders.flatMap((o) => o.payments ?? []).reduce(
    (sum, p) => sum + Number(p.amount),
    0
  );

  return {
    id: customer.id,
    name: customer.name,
    city: customer.city ?? undefined,
    source: customer.source,
    whatsappOptIn: customer.whatsappOptIn,
    totalOrders: paidOrders.length,
    totalSpend,
    lastOrderDate: customer.orders[0]?.createdAt.toISOString(),
    preferredColours: uniqueColours,
    interactionCount: customer.interactions.length,
    activeReservations: customer.reservations.length,
    outstandingAmount,
  };
}

/**
 * Returns recent interactions for a customer.
 */
export async function getCustomerInteractions(
  customerId: string,
  limit = 10
): Promise<{ type: string; createdAt: string; productName?: string }[]> {
  const interactions = await prisma.customerInteraction.findMany({
    where: { customerId },
    include: { product: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  return interactions.map((i) => ({
    type: i.type,
    createdAt: i.createdAt.toISOString(),
    productName: i.product?.name,
  }));
}

/**
 * Returns available products that match a customer's colour preferences.
 * Uses simple heuristic matching — not fake ML percentages.
 */
export async function findMatchingProducts(
  customerId: string,
  limit = 6
): Promise<ProductMatchResult[]> {
  const profile = await getCustomerProfile(customerId);
  if (!profile) return [];

  const availableProducts = await prisma.product.findMany({
    where: {
      inventoryStatus: 'AVAILABLE',
      publishStatus: 'PUBLISHED',
    },
    include: { category: true },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  // Score products by colour match
  const scored = availableProducts.map((p) => {
    const productColours = [p.primaryColour, ...(p.secondaryColours?.split(',') ?? [])]
      .map((c) => c?.trim().toLowerCase())
      .filter(Boolean) as string[];

    const preferredLower = profile.preferredColours.map((c) => c.toLowerCase());

    let matchCount = 0;
    let matchReason = 'Available product in stock';

    for (const pc of productColours) {
      for (const preferred of preferredLower) {
        if (pc.includes(preferred) || preferred.includes(pc)) {
          matchCount++;
          matchReason = `Matches preferred colour: ${p.primaryColour}`;
        }
      }
    }

    return { product: p, score: matchCount };
  });

  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, limit).map(({ product, score }) => ({
    id: product.id,
    productCode: product.productCode,
    name: product.name,
    price: Number(product.price),
    primaryColour: product.primaryColour ?? undefined,
    inventoryStatus: product.inventoryStatus,
    category: product.category.name,
    matchReason:
      score > 0
        ? `Matches preferred colour: ${product.primaryColour}`
        : 'Available and in stock',
  }));
}

/**
 * Returns product details for AI context.
 */
export async function getProductDetails(productId: string) {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: {
      category: true,
      images: { where: { isPrimary: true }, take: 1 },
      attributes: { include: { definition: true } },
    },
  });
  if (!product) return null;

  return {
    id: product.id,
    productCode: product.productCode,
    name: product.name,
    price: Number(product.price),
    primaryColour: product.primaryColour,
    secondaryColours: product.secondaryColours,
    inventoryStatus: product.inventoryStatus,
    publishStatus: product.publishStatus,
    category: product.category.name,
    shortDesc: product.shortDesc,
    hasDescription: !!product.description,
    imageUrl: product.images[0]?.url,
  };
}

/**
 * Returns outstanding (unpaid) payment summary.
 */
export async function getOutstandingPayments() {
  const unpaidOrders = await prisma.order.findMany({
    where: { paymentStatus: { in: ['UNPAID', 'PENDING'] as any[] } },
    include: { customer: { select: { name: true, mobile: true } } },
    orderBy: { createdAt: 'asc' },
    take: 20,
  });

  const total = unpaidOrders.reduce((sum, o) => sum + Number(o.total), 0);

  return {
    count: unpaidOrders.length,
    totalAmount: total,
    orders: unpaidOrders.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      customerName: o.customer.name,
      amount: Number(o.total),
      daysSinceCreated: Math.floor(
        (Date.now() - o.createdAt.getTime()) / (1000 * 60 * 60 * 24)
      ),
    })),
  };
}

/**
 * Returns a sales summary for a date range.
 */
export async function getSalesSummary(period: 'today' | 'week' | 'month' = 'week') {
  const now = new Date();
  const start = new Date(now);

  if (period === 'today') {
    start.setHours(0, 0, 0, 0);
  } else if (period === 'week') {
    start.setDate(now.getDate() - 7);
  } else {
    start.setMonth(now.getMonth() - 1);
  }

  const orders = await prisma.order.findMany({
    where: {
      paymentStatus: 'PAID',
      updatedAt: { gte: start },
    },
    select: { total: true, orderNumber: true, createdAt: true },
  });

  const totalRevenue = orders.reduce((sum, o) => sum + Number(o.total), 0);

  return {
    period,
    orderCount: orders.length,
    totalRevenue,
    averageOrderValue: orders.length > 0 ? totalRevenue / orders.length : 0,
  };
}

/**
 * Returns active reservations, optionally filtered to expiring soon.
 */
export async function getReservations(options: { expiringSoonMinutes?: number } = {}) {
  const where: Record<string, unknown> = { status: 'ACTIVE' };

  if (options.expiringSoonMinutes) {
    const threshold = new Date(Date.now() + options.expiringSoonMinutes * 60 * 1000);
    where.expiresAt = { lte: threshold };
  }

  const reservations = await prisma.reservation.findMany({
    where: where as any,
    include: {
      customer: { select: { id: true, name: true, mobile: true } },
      product: { select: { id: true, name: true, productCode: true, price: true } },
    },
    orderBy: { expiresAt: 'asc' },
    take: 20,
  });

  return reservations.map((r) => ({
    id: r.id,
    customerName: r.customer.name,
    customerId: r.customer.id,
    productName: r.product.name,
    productCode: r.product.productCode,
    amount: Number(r.product.price),
    expiresAt: r.expiresAt?.toISOString(),
    minutesUntilExpiry: r.expiresAt
      ? Math.floor((r.expiresAt.getTime() - Date.now()) / 60000)
      : null,
  }));
}

/**
 * Returns the Today dashboard summary from real data.
 * This is what powers the AI Today screen — no fake numbers.
 */
export async function getTodaySummary(): Promise<TodaySummaryResult> {
  const now = new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  const [
    expiringReservations,
    outstandingPayments,
    productsWithoutDesc,
    ordersReadyForPickup,
    ordersInTransit,
    deliveryExceptions,
    pendingApprovals,
    dormantConversations,
  ] = await Promise.all([
    // Reservations expiring today
    prisma.reservation.count({
      where: { status: 'ACTIVE', expiresAt: { gte: today, lt: tomorrow } },
    }),
    // Unpaid orders
    prisma.order.findMany({
      where: { paymentStatus: 'UNPAID' },
      select: { total: true },
    }),
    // Products needing descriptions
    prisma.product.count({
      where: { publishStatus: 'PUBLISHED', description: null },
    }),
    // Orders ready for pickup (paid + packed but not yet dispatched)
    prisma.order.count({
      where: {
        status: { in: ['PACKING', 'READY_FOR_PICKUP'] as any[] },
        paymentStatus: 'PAID',
      },
    }),
    // Orders in transit
    prisma.order.count({
      where: {
        status: { in: ['PICKUP_REQUESTED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY'] as any[] },
      },
    }),
    // Delivery exceptions
    prisma.order.count({
      where: { status: 'DELIVERY_FAILED' as any },
    }),
    // Pending AI approvals
    prisma.aIApproval.count({
      where: { status: 'PENDING' },
    }),
    // Conversations that went quiet (last outbound > 3 days, no inbound for 14+ days)
    prisma.whatsAppConversation.count({
      where: {
        lastMessageAt: {
          gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
          lt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        },
      },
    }),
  ]);

  const outstandingTotal = outstandingPayments.reduce(
    (sum, o) => sum + Number(o.total),
    0
  );

  return {
    followUpCustomers: dormantConversations,
    expiringReservations,
    outstandingPaymentsTotal: outstandingTotal,
    outstandingPaymentsCount: outstandingPayments.length,
    productsNeedingDescriptions: productsWithoutDesc,
    ordersReadyForPickup,
    ordersInTransit,
    deliveryExceptions,
    pendingApprovals,
  };
}

/**
 * Logs an AI tool execution for audit.
 */
export async function logAIExecution(params: {
  tool: string;
  userId?: string;
  sessionId?: string;
  inputSummary?: string;
  outputSummary?: string;
  durationMs?: number;
  success?: boolean;
  error?: string;
}) {
  try {
    await prisma.aIExecution.create({
      data: {
        tool: params.tool,
        userId: params.userId,
        sessionId: params.sessionId,
        inputSummary: params.inputSummary,
        outputSummary: params.outputSummary,
        durationMs: params.durationMs,
        success: params.success ?? true,
        error: params.error,
      },
    });
  } catch (err) {
    // Non-fatal — don't break the user experience for an audit log failure
    console.error('[logAIExecution] Failed:', err);
  }
}
