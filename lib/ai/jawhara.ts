/**
 * lib/ai/jawhara.ts
 *
 * Jawhara AI — the three logical business roles backed by Gemini.
 *
 * JAWHARA ASSISTANT     — business overview, what's important today
 * SALES & CRM           — customer insights, follow-ups, drafts
 * PRODUCT & MARKETING   — product matching, campaigns, copy
 *
 * These share the same Gemini infrastructure. They are logical roles,
 * not separate services or autonomous agents.
 *
 * AI is advisory only. It never directly:
 * - marks orders as paid or delivered
 * - changes inventory
 * - sends WhatsApp messages (it prepares drafts for approval)
 * - modifies prices or discounts
 */

import { GoogleGenAI } from '@google/genai';
import {
  getTodaySummary,
  getCustomerProfile,
  findMatchingProducts,
  getOutstandingPayments,
  getReservations,
  getSalesSummary,
  getProductDetails,
  logAIExecution,
} from './tools';
import { prisma } from '@/lib/prisma';

function getAI() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('AI assistance is not configured (GEMINI_API_KEY missing).');
  return new GoogleGenAI({ apiKey });
}

function getModel(): string {
  return process.env.GEMINI_MODEL || 'gemini-2.0-flash';
}

// ─── Ask Jawhara ──────────────────────────────────────────────────────────────

export interface AskJawharaOptions {
  question: string;
  userId?: string;
  sessionId?: string;
}

export interface AskJawharaResult {
  answer: string;
  suggestions?: string[];  // Follow-up actions/questions
  data?: Record<string, unknown>; // Structured data if relevant
}

/**
 * The central conversational interface.
 * Determines which business tools are needed, fetches real data,
 * then asks Gemini to formulate a helpful, accurate answer.
 */
export async function askJawhara(options: AskJawharaOptions): Promise<AskJawharaResult> {
  const start = Date.now();
  const { question, userId, sessionId } = options;

  const ai = getAI();
  const model = getModel();

  // Step 1: Gather relevant business context based on the question
  const context = await gatherContextForQuestion(question);

  // Step 2: Build the prompt with real data
  const systemContext = `You are Jawhara, a helpful business assistant for a luxury boutique called Jawhara that sells bespoke Ridas and handcrafted items.

You help the owner and staff understand and operate the business. You answer questions about:
- Sales, revenue, and orders
- Customers who need follow-up
- Products that need attention
- Reservations expiring
- Outstanding payments
- Delivery status
- What is important today

CRITICAL RULES:
- Only use the business data provided below. Do not invent figures.
- Never claim a payment was received or a delivery happened unless the data shows it.
- Be concise and actionable. Staff are busy — give the key insight first.
- Use INR (₹) for all monetary amounts.
- If you cannot answer from the provided data, say so clearly.
- Suggest specific next actions when appropriate.

BUSINESS DATA:
${JSON.stringify(context, null, 2)}`;

  const prompt = `${systemContext}

Question: ${question}

Provide a clear, helpful answer. Then list 2-3 suggested next actions if relevant.
Format your response as JSON with fields: answer (string), suggestions (string array).`;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            answer: { type: 'STRING' },
            suggestions: { type: 'ARRAY', items: { type: 'STRING' } },
          },
          required: ['answer'],
        },
      },
    });

    const responseText = response.text;
    if (!responseText) throw new Error('Empty response from Gemini.');

    const parsed = JSON.parse(responseText.trim());
    const durationMs = Date.now() - start;

    await logAIExecution({
      tool: 'askJawhara',
      userId,
      sessionId,
      inputSummary: question.slice(0, 100),
      outputSummary: parsed.answer?.slice(0, 100),
      durationMs,
      success: true,
    });

    return {
      answer: parsed.answer,
      suggestions: parsed.suggestions ?? [],
      data: context,
    };
  } catch (err: any) {
    await logAIExecution({
      tool: 'askJawhara',
      userId,
      sessionId,
      inputSummary: question.slice(0, 100),
      durationMs: Date.now() - start,
      success: false,
      error: err.message,
    });
    throw err;
  }
}

/**
 * Determines what business data is needed for a question and fetches it.
 * This is intentionally simple — heuristic keyword matching.
 */
async function gatherContextForQuestion(question: string): Promise<Record<string, unknown>> {
  const q = question.toLowerCase();
  const context: Record<string, unknown> = {};

  // Always include today summary
  context.todaySummary = await getTodaySummary();

  if (q.includes('payment') || q.includes('unpaid') || q.includes('outstanding')) {
    context.outstandingPayments = await getOutstandingPayments();
  }

  if (q.includes('sale') || q.includes('revenue') || q.includes('this week') || q.includes('today')) {
    context.salesSummary = await getSalesSummary('week');
  }

  if (q.includes('reservation') || q.includes('hold') || q.includes('expir')) {
    context.reservations = await getReservations({ expiringSoonMinutes: 24 * 60 });
  }

  if (q.includes('product') || q.includes('sold') || q.includes('description')) {
    const products = await prisma.product.findMany({
      where: { publishStatus: 'PUBLISHED', description: null },
      select: { productCode: true, name: true },
      take: 10,
    });
    context.productsNeedingDescriptions = products;
  }

  return context;
}

// ─── Today Suggestions ────────────────────────────────────────────────────────

export interface TodaySuggestion {
  id: string;
  section: string;  // Sales | Reservations | Payments | Products | Delivery | Marketing
  title: string;
  body: string;
  priority: 'HIGH' | 'NORMAL' | 'LOW';
  entityType?: string;
  entityId?: string;
  action?: string;  // Arrange Pickup | View Customer | Draft WhatsApp | etc.
}

/**
 * Generates the Today screen suggestions from real business data.
 * No AI model call needed — data speaks for itself.
 * Returns structured, actionable items backed by actual DB state.
 */
export async function generateTodaySuggestions(): Promise<TodaySuggestion[]> {
  const summary = await getTodaySummary();
  const suggestions: TodaySuggestion[] = [];

  if (summary.followUpCustomers > 0) {
    suggestions.push({
      id: 'follow-up-customers',
      section: 'Sales',
      title: `${summary.followUpCustomers} customer${summary.followUpCustomers > 1 ? 's' : ''} need follow-up`,
      body: 'Customers who have not replied recently.',
      priority: 'NORMAL',
      action: 'View Customers',
    });
  }

  if (summary.expiringReservations > 0) {
    suggestions.push({
      id: 'expiring-reservations',
      section: 'Reservations',
      title: `${summary.expiringReservations} reservation${summary.expiringReservations > 1 ? 's' : ''} expire today`,
      body: 'Contact these customers before their holds are released.',
      priority: 'HIGH',
      action: 'View Reservations',
    });
  }

  if (summary.outstandingPaymentsCount > 0) {
    const amountStr = Number(summary.outstandingPaymentsTotal).toLocaleString('en-IN');
    suggestions.push({
      id: 'outstanding-payments',
      section: 'Payments',
      title: `₹${amountStr} outstanding`,
      body: `${summary.outstandingPaymentsCount} order${summary.outstandingPaymentsCount > 1 ? 's' : ''} awaiting payment.`,
      priority: 'HIGH',
      action: 'View Orders',
    });
  }

  if (summary.productsNeedingDescriptions > 0) {
    suggestions.push({
      id: 'product-descriptions',
      section: 'Products',
      title: `${summary.productsNeedingDescriptions} product${summary.productsNeedingDescriptions > 1 ? 's' : ''} need descriptions`,
      body: 'Published products without descriptions may not sell well.',
      priority: 'LOW',
      action: 'View Products',
    });
  }

  if (summary.ordersReadyForPickup > 0) {
    suggestions.push({
      id: 'orders-ready-pickup',
      section: 'Delivery',
      title: `${summary.ordersReadyForPickup} paid order${summary.ordersReadyForPickup > 1 ? 's' : ''} ready for pickup`,
      body: 'These orders are paid and packed. Arrange courier pickup.',
      priority: 'HIGH',
      action: 'Arrange Pickup',
    });
  }

  if (summary.ordersInTransit > 0) {
    suggestions.push({
      id: 'orders-in-transit',
      section: 'Delivery',
      title: `${summary.ordersInTransit} order${summary.ordersInTransit > 1 ? 's' : ''} in transit`,
      body: 'Shipments currently on their way to customers.',
      priority: 'LOW',
      action: 'View Shipments',
    });
  }

  if (summary.deliveryExceptions > 0) {
    suggestions.push({
      id: 'delivery-exceptions',
      section: 'Delivery',
      title: `${summary.deliveryExceptions} delivery exception${summary.deliveryExceptions > 1 ? 's' : ''}`,
      body: 'These deliveries need attention — contact the customer or courier.',
      priority: 'HIGH',
      action: 'Review Exception',
    });
  }

  if (summary.pendingApprovals > 0) {
    suggestions.push({
      id: 'pending-approvals',
      section: 'AI',
      title: `${summary.pendingApprovals} item${summary.pendingApprovals > 1 ? 's' : ''} waiting for approval`,
      body: 'AI-prepared messages or actions ready for your review.',
      priority: 'NORMAL',
      action: 'Review',
    });
  }

  return suggestions;
}

// ─── Customer Insights ────────────────────────────────────────────────────────

export interface CustomerInsights {
  preferredColours: string[];
  typicalSpendRange: string;
  lastPurchaseLabel: string;
  followUpRecommendation: string;
  matchingProducts: {
    id: string;
    name: string;
    price: number;
    matchReason: string;
  }[];
}

export async function generateCustomerInsights(
  customerId: string
): Promise<CustomerInsights | null> {
  const profile = await getCustomerProfile(customerId);
  if (!profile) return null;

  const matchingProducts = await findMatchingProducts(customerId, 4);

  const lastPurchaseLabel = profile.lastOrderDate
    ? (() => {
        const days = Math.floor(
          (Date.now() - new Date(profile.lastOrderDate).getTime()) / (1000 * 60 * 60 * 24)
        );
        if (days === 0) return 'Today';
        if (days === 1) return 'Yesterday';
        if (days < 7) return `${days} days ago`;
        if (days < 30) return `${Math.floor(days / 7)} week${days < 14 ? '' : 's'} ago`;
        return `${Math.floor(days / 30)} month${days < 60 ? '' : 's'} ago`;
      })()
    : 'No purchases yet';

  // Spend range classification
  let typicalSpendRange = 'New customer';
  if (profile.totalOrders > 0) {
    const avg = profile.totalSpend / profile.totalOrders;
    if (avg < 5000) typicalSpendRange = 'Under ₹5,000 per order';
    else if (avg < 10000) typicalSpendRange = '₹5,000–₹10,000 per order';
    else if (avg < 20000) typicalSpendRange = '₹10,000–₹20,000 per order';
    else typicalSpendRange = 'Over ₹20,000 per order';
  }

  // Simple follow-up recommendation
  let followUpRecommendation = '';
  if (profile.outstandingAmount > 0) {
    followUpRecommendation = `Outstanding payment of ₹${profile.outstandingAmount.toLocaleString('en-IN')} — send a gentle reminder.`;
  } else if (profile.activeReservations > 0) {
    followUpRecommendation = `${profile.activeReservations} active hold${profile.activeReservations > 1 ? 's' : ''} — check if they are ready to purchase.`;
  } else if (profile.lastOrderDate) {
    const days = Math.floor(
      (Date.now() - new Date(profile.lastOrderDate).getTime()) / (1000 * 60 * 60 * 24)
    );
    if (days > 60) {
      followUpRecommendation = 'Has not purchased in over 2 months — a warm check-in could re-engage.';
    } else {
      followUpRecommendation = 'Recent customer — share new arrivals when available.';
    }
  } else {
    followUpRecommendation = 'New customer — introduce yourself and the boutique.';
  }

  return {
    preferredColours: profile.preferredColours,
    typicalSpendRange,
    lastPurchaseLabel,
    followUpRecommendation,
    matchingProducts: matchingProducts.map((p) => ({
      id: p.id,
      name: p.name,
      price: p.price,
      matchReason: p.matchReason,
    })),
  };
}

// ─── WhatsApp Draft Preparation ───────────────────────────────────────────────

export interface PrepareWhatsAppDraftOptions {
  customerId: string;
  context?: string;  // Additional context from staff
  userId?: string;
}

/**
 * Prepares a WhatsApp message draft for staff approval.
 * Creates an AIApproval record — never sends the message directly.
 */
export async function prepareWhatsAppDraft(
  options: PrepareWhatsAppDraftOptions
): Promise<{ approvalId: string; drafts: string[] }> {
  const { customerId, context, userId } = options;

  const profile = await getCustomerProfile(customerId);
  if (!profile) throw new Error('Customer not found.');

  const matchingProducts = await findMatchingProducts(customerId, 3);

  // Use existing generateSuggestedReplies from lib/ai.ts
  const { generateSuggestedReplies } = await import('@/lib/ai');

  const suggestions = await generateSuggestedReplies(
    {
      customerName: profile.name,
      preferredColours: profile.preferredColours.join(', ') || 'Not analyzed',
      priceRangePreference: `Avg spend: ₹${Math.round(profile.totalSpend / Math.max(profile.totalOrders, 1)).toLocaleString('en-IN')}`,
      reservations: [],
      recommended: matchingProducts.map((p) => ({
        name: p.name,
        productCode: p.productCode,
        price: p.price,
      })),
    },
    context || '(No specific context — check in warmly)'
  );

  const drafts = [suggestions.option1, suggestions.option2, suggestions.option3];

  // Create AIApproval record — staff must approve before sending
  const approval = await prisma.aIApproval.create({
    data: {
      type: 'WHATSAPP_MESSAGE',
      entityType: 'CUSTOMER',
      entityId: customerId,
      title: `WhatsApp draft for ${profile.name}`,
      rationale: context
        ? `Staff requested a draft: "${context}"`
        : 'AI prepared a follow-up message based on customer profile.',
      proposedContent: { drafts, customerName: profile.name },
      impact: 'Sends a WhatsApp message to this customer if approved.',
      status: 'PENDING',
    },
  });

  return { approvalId: approval.id, drafts };
}
