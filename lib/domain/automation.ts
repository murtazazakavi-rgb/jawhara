import { prisma } from '@/lib/prisma';
import { sendWhatsAppMessage } from '@/lib/integrations/whatsapp/provider';
import { MessageDirection, MessageStatus, Prisma } from '@prisma/client';
import { 
  sendCustomerReceiptEmail, 
  sendCustomerPaymentFailedEmail, 
  sendAdminNotificationEmail,
  sendEmail
} from '@/lib/integrations/email/provider';

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
          include: { 
            customer: true,
            orderItems: {
              include: { product: true }
            }
          },
        });

        if (!order) return;

        const customer = order.customer;
        const amountStr = Number(order.total).toLocaleString('en-IN');

        // A. Send Customer WhatsApp Notification (if mobile is available)
        if (customer.normalizedMobile) {
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
        }

        // B. Send Customer Receipt Email
        if (customer.email) {
          try {
            await sendCustomerReceiptEmail(order, customer, order.orderItems);
          } catch (emailErr) {
            console.error('Failed to send receipt email to customer:', emailErr);
          }
        }

        // C. Send Admin Email Notification
        const adminEmailSetting = await prisma.systemSetting.findUnique({ where: { key: 'adminEmail' } });
        const enableAdminEmailSetting = await prisma.systemSetting.findUnique({ where: { key: 'enableAdminEmailAlerts' } });
        const adminEmail = adminEmailSetting?.value;
        const enableAdminEmail = enableAdminEmailSetting?.value !== 'false';

        if (adminEmail && enableAdminEmail) {
          const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
          try {
            await sendAdminNotificationEmail(adminEmail, 'ORDER_PAID', {
              orderNumber: order.orderNumber,
              amount: Number(order.total),
              customerName: customer.name,
              customerEmail: customer.email || undefined,
              dashboardLink: `${siteUrl}/orders`,
            });
          } catch (adminEmailErr) {
            console.error('Failed to send admin email alert:', adminEmailErr);
          }
        }

        // D. Send Admin WhatsApp Notification
        const adminWhatsAppSetting = await prisma.systemSetting.findUnique({ where: { key: 'adminWhatsAppNumber' } });
        const enableAdminWhatsAppSetting = await prisma.systemSetting.findUnique({ where: { key: 'enableAdminWhatsAppAlerts' } });
        const adminWhatsAppNumber = adminWhatsAppSetting?.value;
        const enableAdminWhatsApp = enableAdminWhatsAppSetting?.value !== 'false';

        if (adminWhatsAppNumber && enableAdminWhatsApp) {
          try {
            const adminText = `[Admin Alert] New Order Paid!\nOrder: ${order.orderNumber}\nAmount: ₹${amountStr}\nCustomer: ${customer.name}\nPhone: ${customer.mobile || 'N/A'}`;
            await sendWhatsAppMessage({
              to: adminWhatsAppNumber,
              type: 'text',
              text: { body: adminText },
            });
          } catch (waErr) {
            console.error('Failed to send admin WhatsApp alert:', waErr);
          }
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

        if (!product || !customer || !customer.normalizedMobile) return;

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
        if (!customer.normalizedMobile) return;
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

      case 'RESERVATION_CREATED': {
        const { reservationId } = payload;
        const reservation = await prisma.reservation.findUnique({
          where: { id: reservationId },
          include: { customer: true, product: true },
        });

        if (!reservation) return;

        const customer = reservation.customer;
        const product = reservation.product;

        // 1. Notify the customer via WhatsApp
        if (customer.normalizedMobile) {
          const holdSetting = await prisma.systemSetting.findUnique({
            where: { key: 'reservationHoldMinutes' },
          });
          const holdMinutes = holdSetting?.value || '20';
          const text = `Hi ${customer.name},\n\nWe have placed the piece "${product.name}" on hold for you for ${holdMinutes} minutes.\n\nComplete your checkout to purchase: ${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/dashboard`;
          
          await sendWhatsAppMessage({
            to: customer.normalizedMobile,
            type: 'text',
            text: { body: text },
          });
        }

        // 2. Notify the admin via Email
        const adminEmailSetting = await prisma.systemSetting.findUnique({ where: { key: 'adminEmail' } });
        const enableAdminEmailSetting = await prisma.systemSetting.findUnique({ where: { key: 'enableAdminEmailAlerts' } });
        const adminEmail = adminEmailSetting?.value;
        const enableAdminEmail = enableAdminEmailSetting?.value !== 'false';

        if (adminEmail && enableAdminEmail) {
          const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
          try {
            await sendAdminNotificationEmail(adminEmail, 'RESERVATION_CREATED', {
              productName: product.name,
              productCode: product.productCode,
              customerName: customer.name,
              customerEmail: customer.email || undefined,
              dashboardLink: `${siteUrl}/admin`,
            });
          } catch (err) {
            console.error('Failed to send admin reservation email:', err);
          }
        }

        // 3. Notify the admin via WhatsApp
        const adminWhatsAppSetting = await prisma.systemSetting.findUnique({ where: { key: 'adminWhatsAppNumber' } });
        const enableAdminWhatsAppSetting = await prisma.systemSetting.findUnique({ where: { key: 'enableAdminWhatsAppAlerts' } });
        const adminWhatsAppNumber = adminWhatsAppSetting?.value;
        const enableAdminWhatsApp = enableAdminWhatsAppSetting?.value !== 'false';

        if (adminWhatsAppNumber && enableAdminWhatsApp) {
          try {
            const adminText = `[Admin Alert] New Hold Request!\nProduct: ${product.name} (${product.productCode})\nCustomer: ${customer.name}\nPhone: ${customer.mobile || 'N/A'}`;
            await sendWhatsAppMessage({
              to: adminWhatsAppNumber,
              type: 'text',
              text: { body: adminText },
            });
          } catch (err) {
            console.error('Failed to send admin reservation WhatsApp alert:', err);
          }
        }
        break;
      }

      case 'PAYMENT_FAILED': {
        const { orderId, errorMsg } = payload;
        const order = await prisma.order.findUnique({
          where: { id: orderId },
          include: { customer: true },
        });

        if (!order) return;
        const customer = order.customer;

        // 1. Notify customer via Email
        if (customer.email) {
          try {
            await sendCustomerPaymentFailedEmail(order, customer, errorMsg);
          } catch (emailErr) {
            console.error('Failed to send payment failure email to customer:', emailErr);
          }
        }

        // 2. Notify admin via Email
        const adminEmailSetting = await prisma.systemSetting.findUnique({ where: { key: 'adminEmail' } });
        const enableAdminEmailSetting = await prisma.systemSetting.findUnique({ where: { key: 'enableAdminEmailAlerts' } });
        const adminEmail = adminEmailSetting?.value;
        const enableAdminEmail = enableAdminEmailSetting?.value !== 'false';

        if (adminEmail && enableAdminEmail) {
          try {
            await sendEmail({
              to: adminEmail,
              subject: `[ALERT] Payment Failed for Order: ${order.orderNumber}`,
              html: `<p>Payment transaction failed for Order <strong>${order.orderNumber}</strong>.<br/>Customer: ${customer.name}<br/>Reason: ${errorMsg || 'Unknown error'}</p>`,
            });
          } catch (adminErr) {
            console.error('Failed to notify admin of failed payment email:', adminErr);
          }
        }

        // 3. Notify admin via WhatsApp
        const adminWhatsAppSetting = await prisma.systemSetting.findUnique({ where: { key: 'adminWhatsAppNumber' } });
        const enableAdminWhatsAppSetting = await prisma.systemSetting.findUnique({ where: { key: 'enableAdminWhatsAppAlerts' } });
        const adminWhatsAppNumber = adminWhatsAppSetting?.value;
        const enableAdminWhatsApp = enableAdminWhatsAppSetting?.value !== 'false';

        if (adminWhatsAppNumber && enableAdminWhatsApp) {
          try {
            const adminText = `[Admin Alert] Payment FAILED!\nOrder: ${order.orderNumber}\nCustomer: ${customer.name}\nReason: ${errorMsg || 'Unknown error'}`;
            await sendWhatsAppMessage({
              to: adminWhatsAppNumber,
              type: 'text',
              text: { body: adminText },
            });
          } catch (waErr) {
            console.error('Failed to send admin payment failed WhatsApp alert:', waErr);
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
