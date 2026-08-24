import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { normalizePhoneNumber } from '@/lib/phone';
import { emitBusinessEvent } from '@/lib/domain/automation';
import crypto from 'crypto';
import { MessageStatus, MessageDirection, WebhookProvider, WebhookStatus } from '@prisma/client';

/**
 * GET handler for Meta Webhook verification handshake.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('hub.mode');
    const token = searchParams.get('hub.verify_token');
    const challenge = searchParams.get('hub.challenge');

    const expectedToken = process.env.META_WHATSAPP_VERIFY_TOKEN || 'jawhara_verify_token_2026';

    if (mode && token) {
      if (mode === 'subscribe' && token === expectedToken) {
        console.log('Meta Webhook verification passed.');
        return new Response(challenge, { status: 200 });
      }
    }

    console.warn('Meta Webhook verification failed: verify token mismatch.');
    return new Response('Forbidden', { status: 403 });
  } catch (error: any) {
    console.error('Webhook GET error:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}

/**
 * POST handler for incoming Meta Webhook events.
 */
export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get('X-Hub-Signature-256');
    const appSecret = process.env.META_APP_SECRET;

    // 1. Authenticity signature check (only if APP_SECRET is configured)
    if (appSecret && signature) {
      const hmac = crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');
      const expectedSignature = `sha256=${hmac}`;
      if (signature !== expectedSignature) {
        console.warn('Webhook POST signature check failed.');
        return NextResponse.json({ error: 'Invalid signature.' }, { status: 401 });
      }
    }

    const payload = JSON.parse(rawBody);

    // Verify this is a standard whatsapp event structure
    if (payload.object !== 'whatsapp_business_account' || !payload.entry?.[0]?.changes?.[0]?.value) {
      return NextResponse.json({ success: true, message: 'Non-message webhook skipped.' });
    }

    const change = payload.entry[0].changes[0];
    const value = change.value;
    const wabaId = payload.entry[0].id;

    // Generate a unique identifier for this webhook batch to enforce idempotency
    const eventId = signature 
      ? crypto.createHash('md5').update(rawBody).digest('hex')
      : `event-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

    // Create a WebhookEvent record (idempotent unique index checks)
    try {
      await prisma.webhookEvent.create({
        data: {
          provider: WebhookProvider.META_WHATSAPP,
          externalEventId: eventId,
          eventType: change.field || 'messages',
          payload: payload,
          status: WebhookStatus.RECEIVED,
        },
      });
    } catch (dbErr: any) {
      // Unique constraint code for prisma is P2002
      if (dbErr.code === 'P2002') {
        console.log(`Duplicate webhook event ${eventId} received. Skipping processing.`);
        return NextResponse.json({ success: true, message: 'Already processed.' });
      }
      throw dbErr;
    }

    // A. Handle Status Updates (sent, delivered, read, failed)
    if (value.statuses && value.statuses.length > 0) {
      const statusUpdate = value.statuses[0];
      const wamid = statusUpdate.id;
      const status = statusUpdate.status; // sent, delivered, read, failed

      let dbStatus: MessageStatus = MessageStatus.QUEUED;
      if (status === 'sent') dbStatus = MessageStatus.SENT;
      if (status === 'delivered') dbStatus = MessageStatus.DELIVERED;
      if (status === 'read') dbStatus = MessageStatus.READ;
      if (status === 'failed') dbStatus = MessageStatus.FAILED;

      const message = await prisma.whatsAppMessage.findUnique({
        where: { providerMessageId: wamid },
      });

      if (message) {
        await prisma.whatsAppMessage.update({
          where: { id: message.id },
          data: {
            status: dbStatus,
            deliveredAt: status === 'delivered' || status === 'read' ? new Date() : null,
            readAt: status === 'read' ? new Date() : null,
            failedAt: status === 'failed' ? new Date() : null,
            failureReason: status === 'failed' ? (statusUpdate.errors?.[0]?.message || 'Meta Delivery Failure') : null,
          },
        });
      }

      await prisma.webhookEvent.update({
        where: { externalEventId: eventId },
        data: { status: WebhookStatus.PROCESSED, processedAt: new Date() },
      });

      return NextResponse.json({ success: true });
    }

    // B. Handle Inbound Messages
    if (value.messages && value.messages.length > 0) {
      const message = value.messages[0];
      const from = message.from; // Phone sender (E.164 without prefix usually)
      const contactName = value.contacts?.[0]?.profile?.name || 'Customer';
      const wamid = message.id;
      const msgType = message.type; // text, image, interactive, button, etc.
      
      let bodyText = '';
      if (msgType === 'text') bodyText = message.text?.body || '';
      else if (msgType === 'button') bodyText = message.button?.text || '';
      else if (msgType === 'interactive') {
        const interactiveType = message.interactive?.type;
        if (interactiveType === 'button_reply') bodyText = message.interactive?.button_reply?.title || '';
        if (interactiveType === 'list_reply') bodyText = message.interactive?.list_reply?.title || '';
      }

      const normalizedMobile = normalizePhoneNumber(from);

      // Identity Resolution - Find or create Customer
      let customer = await prisma.customer.findUnique({
        where: { normalizedMobile },
      });

      if (!customer) {
        customer = await prisma.customer.create({
          data: {
            name: contactName,
            mobile: from,
            normalizedMobile,
            whatsappWaId: from,
            whatsappProfileName: contactName,
            whatsappOptIn: true,
            whatsappOptInAt: new Date(),
            whatsappOptInSource: 'WHATSAPP_INBOUND',
            source: 'WHATSAPP',
          },
        });
      }

      // Find or create Conversation
      let conversation = await prisma.whatsAppConversation.findUnique({
        where: { waId: normalizedMobile },
      });

      if (!conversation) {
        conversation = await prisma.whatsAppConversation.create({
          data: {
            customerId: customer.id,
            waId: normalizedMobile,
            status: 'OPEN',
            unreadCount: 1,
            lastMessageAt: new Date(),
            lastInboundAt: new Date(),
            serviceWindowExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          },
        });
      } else {
        await prisma.whatsAppConversation.update({
          where: { id: conversation.id },
          data: {
            unreadCount: { increment: 1 },
            lastMessageAt: new Date(),
            lastInboundAt: new Date(),
            serviceWindowExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          },
        });
      }

      // Store Inbound Message
      const dbMessage = await prisma.whatsAppMessage.create({
        data: {
          conversationId: conversation.id,
          providerMessageId: wamid,
          direction: MessageDirection.INBOUND,
          type: msgType.toUpperCase(),
          status: MessageStatus.DELIVERED,
          body: bodyText || `[Inbound Media/Interactive: ${msgType.toUpperCase()}]`,
          rawPayload: message,
          sentAt: new Date(),
        },
      });

      // Product Inquiry Detection via SKU Code: e.g. JWR-[CAT]-[YY]-[SEQ]
      const skuRegex = /JWR-[A-Z0-9]+-[0-9]{2}-[0-9]{4}/i;
      const skuMatch = bodyText.match(skuRegex);

      if (skuMatch) {
        const matchedSKU = skuMatch[0].toUpperCase();
        const product = await prisma.product.findUnique({
          where: { productCode: matchedSKU },
        });

        if (product) {
          // Log CRM Interaction
          await prisma.customerInteraction.create({
            data: {
              customerId: customer.id,
              productId: product.id,
              conversationId: conversation.id,
              type: 'WHATSAPP_INQUIRY',
              metadata: {
                messageId: dbMessage.id,
                messageText: bodyText,
              },
            },
          });

          // Log Activity audit
          await prisma.activityLog.create({
            data: {
              entityType: 'PRODUCT',
              entityId: product.id,
              action: 'WHATSAPP_INQUIRY_RECEIVED',
              metadata: JSON.stringify({ customerId: customer.id, bodyText }),
            },
          });

          // Emit event for automated checkout checks or responder triggers
          await emitBusinessEvent('PRODUCT_INQUIRY_CREATED', {
            customerId: customer.id,
            productId: product.id,
            conversationId: conversation.id,
            messageBody: bodyText,
          });
        }
      } else {
        // Emit basic message received event
        await emitBusinessEvent('CUSTOMER_MESSAGE_RECEIVED', {
          customerId: customer.id,
          conversationId: conversation.id,
          messageBody: bodyText,
        });
      }

      // Update WebhookEvent processing status
      await prisma.webhookEvent.update({
        where: { externalEventId: eventId },
        data: { status: WebhookStatus.PROCESSED, processedAt: new Date() },
      });

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: true, message: 'Unrecognized structure' });
  } catch (error: any) {
    console.error('Meta Webhook handler error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
