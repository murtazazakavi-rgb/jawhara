import { prisma } from '@/lib/prisma';
import { sendWhatsAppMessage } from '@/lib/integrations/whatsapp/provider';
import { MessageDirection, MessageStatus, Prisma } from '@prisma/client';

/**
 * Emits a lifecycle business event and triggers automated reactions based on rules.
 */
export async function emitBusinessEvent(eventType: string, payload: any) {
  console.log(`[BUSINESS EVENT] Emitted "${eventType}":`, JSON.stringify(payload, null, 2));

  try {
    // 1. Check if WhatsApp automation setting is globally enabled
    const autoSetting = await prisma.systemSetting.findUnique({
      where: { key: 'enableWhatsAppAutomation' },
    });
    if (autoSetting && autoSetting.value === 'false') {
      console.log(`Automation skipped: global enableWhatsAppAutomation is set to false.`);
      return;
    }

    // 2. Handle specific events
    switch (eventType) {
      case 'PAYMENT_RECEIVED': {
        const { orderId } = payload;
        const order = await prisma.order.findUnique({
          where: { id: orderId },
          include: { customer: true },
        });

        if (!order) return;

        const customer = order.customer;
        const amountStr = Number(order.total).toLocaleString('en-IN');
        
        // Check if there is an approved template
        const template = await prisma.whatsAppTemplate.findUnique({
          where: { internalKey: 'PAYMENT_RECEIVED' },
        });

        let sendRes;
        if (template && template.enabled && template.metaTemplateName) {
          sendRes = await sendWhatsAppMessage({
            to: customer.normalizedMobile,
            type: 'template',
            template: {
              name: template.metaTemplateName,
              language: { code: template.languageCode },
              components: [
                {
                  type: 'body',
                  parameters: [
                    { type: 'text', text: customer.name },
                    { type: 'text', text: order.orderNumber },
                    { type: 'text', text: `INR ${amountStr}` },
                  ],
                },
              ],
            },
          });
        } else {
          // Fallback text message
          const text = `Payment received successfully!\n\nOrder: ${order.orderNumber}\nAmount: ₹${amountStr}\n\nThank you for shopping with Jawhara. We will notify you once your order is dispatched.`;
          sendRes = await sendWhatsAppMessage({
            to: customer.normalizedMobile,
            type: 'text',
            text: { body: text },
          });
        }

        // Log outgoing message to conversation
        if (sendRes.success) {
          let conversation = await prisma.whatsAppConversation.findUnique({
            where: { waId: customer.normalizedMobile },
          });
          if (!conversation) {
            conversation = await prisma.whatsAppConversation.create({
              data: {
                customerId: customer.id,
                waId: customer.normalizedMobile,
                lastMessageAt: new Date(),
              },
            });
          }
          await prisma.whatsAppMessage.create({
            data: {
              conversationId: conversation.id,
              providerMessageId: sendRes.providerMessageId,
              direction: MessageDirection.OUTBOUND,
              type: 'TEXT',
              status: MessageStatus.SENT,
              body: `[Automated] Payment received. Order: ${order.orderNumber}, Amount: ₹${amountStr}`,
              sentAt: new Date(),
            },
          });
        }
        break;
      }

      case 'PRODUCT_INQUIRY_CREATED': {
        const { customerId, productId, conversationId, messageBody } = payload;
        const product = await prisma.product.findUnique({
          where: { id: productId },
        });
        const customer = await prisma.customer.findUnique({
          where: { id: customerId },
        });

        if (!product || !customer) return;

        // Auto respond with product details if enabled
        const autoRespondSetting = await prisma.systemSetting.findUnique({
          where: { key: 'enableAutoProductResponder' },
        });
        if (autoRespondSetting && autoRespondSetting.value === 'false') {
          return; // Skip auto responder, let staff reply manually
        }

        const priceStr = Number(product.price).toLocaleString('en-IN');
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
        
        const responseText = `Here is the detail of the item you inquired about:\n\n*${product.name}*\nPrice: ₹${priceStr}\nAvailability: *${product.inventoryStatus}*\n\nReview photos & specs here: ${siteUrl}/p/${product.slug}`;

        const sendRes = await sendWhatsAppMessage({
          to: customer.normalizedMobile,
          type: 'text',
          text: { body: responseText },
        });

        if (sendRes.success) {
          await prisma.whatsAppMessage.create({
            data: {
              conversationId,
              providerMessageId: sendRes.providerMessageId,
              direction: MessageDirection.OUTBOUND,
              type: 'TEXT',
              status: MessageStatus.SENT,
              body: responseText,
              sentAt: new Date(),
            },
          });
        }
        break;
      }

      case 'ORDER_DISPATCHED': {
        const { orderId, trackingNumber, trackingUrl, carrier } = payload;
        const order = await prisma.order.findUnique({
          where: { id: orderId },
          include: { customer: true },
        });

        if (!order) return;

        const customer = order.customer;
        const template = await prisma.whatsAppTemplate.findUnique({
          where: { internalKey: 'ORDER_DISPATCHED' },
        });

        let sendRes;
        if (template && template.enabled && template.metaTemplateName) {
          sendRes = await sendWhatsAppMessage({
            to: customer.normalizedMobile,
            type: 'template',
            template: {
              name: template.metaTemplateName,
              language: { code: template.languageCode },
              components: [
                {
                  type: 'body',
                  parameters: [
                    { type: 'text', text: customer.name },
                    { type: 'text', text: order.orderNumber },
                    { type: 'text', text: carrier || 'Courier' },
                    { type: 'text', text: trackingNumber },
                  ],
                },
              ],
            },
          });
        } else {
          const text = `Your order ${order.orderNumber} has been dispatched via ${carrier || 'Courier'}.\n\nTracking Number: ${trackingNumber}\nTracking URL: ${trackingUrl || 'N/A'}\n\nThank you for shopping with Jawhara!`;
          sendRes = await sendWhatsAppMessage({
            to: customer.normalizedMobile,
            type: 'text',
            text: { body: text },
          });
        }

        if (sendRes.success) {
          let conversation = await prisma.whatsAppConversation.findUnique({
            where: { waId: customer.normalizedMobile },
          });
          if (conversation) {
            await prisma.whatsAppMessage.create({
              data: {
                conversationId: conversation.id,
                providerMessageId: sendRes.providerMessageId,
                direction: MessageDirection.OUTBOUND,
                type: 'TEXT',
                status: MessageStatus.SENT,
                body: `[Automated] Order dispatched. Tracking: ${trackingNumber}`,
                sentAt: new Date(),
              },
            });
          }
        }
        break;
      }

      default:
        console.log(`No automated action configured for event type: ${eventType}`);
    }
  } catch (err) {
    console.error('emitBusinessEvent runner error:', err);
  }
}
