import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { normalizePhoneNumber } from '@/lib/phone';
import { emitBusinessEvent } from '@/lib/domain/automation';
import crypto from 'crypto';
import { MessageStatus, MessageDirection, WebhookProvider, WebhookStatus } from '@prisma/client';

/**
 * GET handler for Evolution Webhook health check.
 */
export async function GET() {
  return NextResponse.json({
    status: 'active',
    provider: 'EVOLUTION_GO',
    timestamp: new Date().toISOString(),
  });
}

/**
 * POST handler for incoming Evolution Go Webhook events.
 */
export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    if (!rawBody || rawBody.trim() === '') {
      return NextResponse.json({ success: true, message: 'Empty body ignored.' });
    }

    const payload = JSON.parse(rawBody);
    const eventType = payload.event || payload.type || 'unknown';

    // Generate unique event ID for idempotency tracking
    const eventId = crypto.createHash('md5').update(rawBody).digest('hex');

    try {
      await prisma.webhookEvent.create({
        data: {
          provider: WebhookProvider.EVOLUTION,
          externalEventId: eventId,
          eventType: eventType,
          payload: payload,
          status: WebhookStatus.RECEIVED,
        },
      });
    } catch (dbErr: any) {
      if (dbErr.code === 'P2002') {
        // Event already processed
        return NextResponse.json({ success: true, message: 'Duplicate event skipped.' });
      }
      // If table/schema lacks EVOLUTION enum, proceed without fatal failure
      console.warn('WebhookEvent tracking notice:', dbErr?.message);
    }

    // 1. Handle Status / Receipt Updates (read, delivered)
    if (eventType === 'Receipt' || eventType === 'messages.update' || eventType === 'sendstatus') {
      const receiptData = payload.data || {};
      const messageIds: string[] = Array.isArray(receiptData.messageIds) 
        ? receiptData.messageIds 
        : receiptData.id ? [receiptData.id] : [];
      
      const statusType = (receiptData.status || '').toLowerCase();
      let dbStatus: MessageStatus | null = null;
      if (statusType.includes('read')) dbStatus = MessageStatus.READ;
      else if (statusType.includes('deliver')) dbStatus = MessageStatus.DELIVERED;
      else if (statusType.includes('fail') || statusType.includes('error')) dbStatus = MessageStatus.FAILED;

      if (dbStatus && messageIds.length > 0) {
        for (const mid of messageIds) {
          const existing = await prisma.whatsAppMessage.findUnique({
            where: { providerMessageId: mid },
          });
          if (existing) {
            await prisma.whatsAppMessage.update({
              where: { id: existing.id },
              data: {
                status: dbStatus,
                deliveredAt: dbStatus === MessageStatus.DELIVERED || dbStatus === MessageStatus.READ ? new Date() : existing.deliveredAt,
                readAt: dbStatus === MessageStatus.READ ? new Date() : existing.readAt,
                failedAt: dbStatus === MessageStatus.FAILED ? new Date() : existing.failedAt,
              },
            });
          }
        }
      }

      return NextResponse.json({ success: true, message: 'Receipt processed' });
    }

    // 2. Handle Inbound Messages
    if (eventType === 'Message' || eventType === 'messages.upsert' || eventType === 'messages') {
      const data = payload.data || {};
      const info = data.Info || data.info || data.key || {};
      const messageObj = data.Message || data.message || {};

      // Ignore messages sent by ourselves or group chats if configured
      const isFromMe = info.IsFromMe ?? info.fromMe ?? false;
      const rawSender = info.Sender || info.Chat || data.Sender || data.from || '';
      
      // Filter out group chats (@g.us) or status broadcasts
      if (rawSender.includes('@g.us') || rawSender.includes('@broadcast')) {
        return NextResponse.json({ success: true, message: 'Group/Broadcast skipped.' });
      }

      if (isFromMe) {
        return NextResponse.json({ success: true, message: 'Outbound echo skipped.' });
      }

      // Extract phone number from JID (e.g. "917016527673@s.whatsapp.net" -> "917016527673")
      const phoneDigits = rawSender.split('@')[0].replace(/\D/g, '');
      if (!phoneDigits) {
        return NextResponse.json({ success: true, message: 'No valid sender digits found.' });
      }

      const normalizedMobile = normalizePhoneNumber(phoneDigits);
      const contactName = info.PushName || data.PushName || data.pushName || 'Customer';
      const wamid = info.ID || data.ID || info.id || `evo-msg-${Date.now()}`;

      // Extract text content from various WhatsApp message structures
      let bodyText = '';
      let msgType = 'TEXT';

      if (messageObj.conversation) {
        bodyText = messageObj.conversation;
      } else if (messageObj.extendedTextMessage?.text) {
        bodyText = messageObj.extendedTextMessage.text;
      } else if (messageObj.imageMessage) {
        msgType = 'IMAGE';
        bodyText = messageObj.imageMessage.caption || '[Photo / Lookbook Attachment]';
      } else if (messageObj.documentMessage) {
        msgType = 'DOCUMENT';
        bodyText = messageObj.documentMessage.title || messageObj.documentMessage.caption || '[Document Attachment]';
      } else if (data.text) {
        bodyText = data.text;
      } else if (data.body) {
        bodyText = data.body;
      }

      // Identity Resolution - Find or create Customer in Jawhara CRM
      let customer = await prisma.customer.findUnique({
        where: { normalizedMobile },
      });

      if (!customer) {
        customer = await prisma.customer.create({
          data: {
            name: contactName,
            email: `${normalizedMobile}@whatsapp.jawhara.com`,
            mobile: `+${phoneDigits}`,
            normalizedMobile,
            whatsappWaId: phoneDigits,
            whatsappProfileName: contactName,
            whatsappOptIn: true,
            whatsappOptInAt: new Date(),
            whatsappOptInSource: 'WHATSAPP_INBOUND_EVOLUTION',
            source: 'WHATSAPP',
          },
        });
      }

      // Find or create Conversation Thread
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

      // Store Inbound WhatsApp Message
      const dbMessage = await prisma.whatsAppMessage.create({
        data: {
          conversationId: conversation.id,
          providerMessageId: wamid,
          direction: MessageDirection.INBOUND,
          type: msgType,
          status: MessageStatus.DELIVERED,
          body: bodyText || `[Inbound ${msgType}]`,
          rawPayload: payload,
          sentAt: new Date(),
        },
      });

      // Product SKU Inquiry Detection: e.g. JWR-RIDA-26-0001
      const skuRegex = /JWR-[A-Z0-9]+-[0-9]{2}-[0-9]{4}/i;
      const skuMatch = bodyText.match(skuRegex);

      if (skuMatch) {
        const matchedSKU = skuMatch[0].toUpperCase();
        const product = await prisma.product.findUnique({
          where: { productCode: matchedSKU },
        });

        if (product) {
          // Log CRM Customer Interaction
          await prisma.customerInteraction.create({
            data: {
              customerId: customer.id,
              productId: product.id,
              conversationId: conversation.id,
              type: 'WHATSAPP_INQUIRY',
              metadata: {
                messageId: dbMessage.id,
                messageText: bodyText,
                source: 'EVOLUTION_GO',
              },
            },
          });

          // Log Activity Audit
          await prisma.activityLog.create({
            data: {
              entityType: 'PRODUCT',
              entityId: product.id,
              action: 'WHATSAPP_INQUIRY_RECEIVED',
              metadata: JSON.stringify({ customerId: customer.id, bodyText, provider: 'evolution' }),
            },
          });

          // Emit business event for automated hold notifications or AI suggestions
          await emitBusinessEvent('PRODUCT_INQUIRY_CREATED', {
            customerId: customer.id,
            productId: product.id,
            conversationId: conversation.id,
            messageBody: bodyText,
          });
        }
      } else {
        // Emit general message received event
        await emitBusinessEvent('CUSTOMER_MESSAGE_RECEIVED', {
          customerId: customer.id,
          conversationId: conversation.id,
          messageBody: bodyText,
        });
      }

      return NextResponse.json({ success: true, messageId: dbMessage.id });
    }

    return NextResponse.json({ success: true, message: `Event ${eventType} received.` });
  } catch (error: any) {
    console.error('Evolution Webhook error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
