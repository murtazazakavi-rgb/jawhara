import nodemailer from 'nodemailer';

// Create nodemailer transporter using SMTP environment variables
function getTransporter() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const secure = process.env.SMTP_SECURE === 'true';
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    // Missing credentials - return null to signal mock mode
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
  });
}

/**
 * Sends a generic HTML email or prints to console if in mock mode
 */
export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ success: boolean; error?: string; mock?: boolean }> {
  const transporter = getTransporter();
  const from = process.env.SMTP_FROM || 'Jawhara <noreply@jawhara-os.com>';

  if (!transporter) {
    console.log('--- [MOCK EMAIL OUTBOUND] ---');
    console.log(`From:    ${from}`);
    console.log(`To:      ${to}`);
    console.log(`Subject: ${subject}`);
    console.log('HTML Body:');
    console.log(html);
    console.log('------------------------------');
    return { success: true, mock: true };
  }

  try {
    const info = await transporter.sendMail({
      from,
      to,
      subject,
      html,
    });
    console.log(`Email sent successfully: ${info.messageId}`);
    return { success: true };
  } catch (error: any) {
    console.error('Failed to send email:', error);
    return { success: false, error: error.message || String(error) };
  }
}

/**
 * Sends a beautifully styled order receipt email to the customer
 */
export async function sendCustomerReceiptEmail(order: any, customer: any, items: any[]) {
  const totalStr = Number(order.total).toLocaleString('en-IN', { style: 'currency', currency: 'INR' });
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

  const itemsHtml = items
    .map(
      (item) => `
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid #eeeeee;">
        <div style="font-weight: 600; color: #333333;">${item.product.name}</div>
        <div style="font-size: 12px; color: #777777;">Code: ${item.product.productCode}</div>
      </td>
      <td style="padding: 12px; border-bottom: 1px solid #eeeeee; text-align: center;">${item.quantity}</td>
      <td style="padding: 12px; border-bottom: 1px solid #eeeeee; text-align: right; font-weight: 600; color: #333333;">
        ${Number(item.finalPrice).toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}
      </td>
    </tr>
  `
    )
    .join('');

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Your Jawhara Receipt</title>
    </head>
    <body style="font-family: 'Hanken Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #FDF7F8; margin: 0; padding: 40px 20px; color: #333333;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid rgba(117, 85, 102, 0.15); box-shadow: 0 4px 12px rgba(0,0,0,0.02);">
        <!-- Header banner -->
        <div style="background-color: #755566; padding: 32px; text-align: center; color: #ffffff;">
          <h1 style="margin: 0; font-family: 'Playfair Display', serif; font-size: 28px; font-weight: 500; letter-spacing: -0.5px;">Jawhara</h1>
          <p style="margin: 8px 0 0 0; font-size: 14px; opacity: 0.85; text-transform: uppercase; tracking-wider: 1px;">Order Confirmation & Receipt</p>
        </div>
        
        <!-- Main body -->
        <div style="padding: 32px;">
          <p style="margin-top: 0; font-size: 16px; line-height: 1.6; color: #444444;">
            Dear <strong>${customer.name}</strong>,
          </p>
          <p style="font-size: 15px; line-height: 1.6; color: #444444;">
            Thank you for your purchase! We have successfully received your payment for order <strong>${order.orderNumber}</strong>. Your piece is now reserved and transitioning to our packaging team.
          </p>
          
          <!-- Summary card -->
          <div style="background-color: #FAF6F7; border-radius: 8px; padding: 20px; margin: 24px 0; border: 1px solid rgba(117, 85, 102, 0.05);">
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
              <tr>
                <td style="padding: 4px 0; color: #777777;">Order Number</td>
                <td style="padding: 4px 0; text-align: right; font-weight: 600; color: #755566;">${order.orderNumber}</td>
              </tr>
              <tr>
                <td style="padding: 4px 0; color: #777777;">Payment Status</td>
                <td style="padding: 4px 0; text-align: right; font-weight: 600; color: #2e7d32;">PAID</td>
              </tr>
              <tr>
                <td style="padding: 4px 0; color: #777777;">Date</td>
                <td style="padding: 4px 0; text-align: right; color: #333333;">${new Date(order.createdAt).toLocaleDateString('en-IN', { dateStyle: 'medium' })}</td>
              </tr>
            </table>
          </div>

          <!-- Items Table -->
          <h3 style="font-family: 'Playfair Display', serif; font-size: 18px; margin: 24px 0 12px 0; color: #755566; border-bottom: 1px solid rgba(117, 85, 102, 0.1); padding-bottom: 8px;">Order Details</h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 14px; margin-bottom: 24px;">
            <thead>
              <tr style="background-color: #f9f9f9;">
                <th style="padding: 10px 12px; text-align: left; color: #777777; font-weight: 500;">Item</th>
                <th style="padding: 10px 12px; text-align: center; color: #777777; font-weight: 500;">Qty</th>
                <th style="padding: 10px 12px; text-align: right; color: #777777; font-weight: 500;">Price</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
              <tr>
                <td colspan="2" style="padding: 16px 12px 12px 12px; text-align: right; font-weight: 600; color: #555555;">Grand Total:</td>
                <td style="padding: 16px 12px 12px 12px; text-align: right; font-weight: 700; font-size: 16px; color: #755566;">${totalStr}</td>
              </tr>
            </tbody>
          </table>

          <div style="text-align: center; margin-top: 32px; border-top: 1px solid #eeeeee; padding-top: 24px;">
            <a href="${siteUrl}/dashboard" style="display: inline-block; background-color: #755566; color: #ffffff; text-decoration: none; padding: 12px 24px; font-weight: 600; font-size: 14px; border-radius: 30px; letter-spacing: 0.5px;">View Your Lookbook Dashboard</a>
          </div>
        </div>
        <!-- Footer -->
        <div style="background-color: #F8F4F6; padding: 24px; text-align: center; font-size: 12px; color: #888888; border-top: 1px solid rgba(117, 85, 102, 0.05);">
          <p style="margin: 0 0 8px 0;">Jawhara OS · Handcrafted Luxury</p>
          <p style="margin: 0;">If you have any questions or require custom tailoring, chat with us on WhatsApp or reply directly to this email.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to: customer.email,
    subject: `Order Receipt - ${order.orderNumber} - Jawhara`,
    html,
  });
}

/**
 * Sends a notification email to the customer when a payment fails or an error occurs
 */
export async function sendCustomerPaymentFailedEmail(order: any, customer: any, errorMsg?: string) {
  const totalStr = Number(order.total).toLocaleString('en-IN', { style: 'currency', currency: 'INR' });
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Payment Attempt Failed</title>
    </head>
    <body style="font-family: 'Hanken Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #FDF7F8; margin: 0; padding: 40px 20px; color: #333333;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid rgba(220, 53, 69, 0.15); box-shadow: 0 4px 12px rgba(0,0,0,0.02);">
        <!-- Header banner -->
        <div style="background-color: #dc3545; padding: 32px; text-align: center; color: #ffffff;">
          <h1 style="margin: 0; font-family: 'Playfair Display', serif; font-size: 26px; font-weight: 500;">Payment Transaction Alert</h1>
          <p style="margin: 8px 0 0 0; font-size: 13px; opacity: 0.9; text-transform: uppercase;">Payment Attempt Failed</p>
        </div>
        
        <!-- Main body -->
        <div style="padding: 32px;">
          <p style="margin-top: 0; font-size: 16px; line-height: 1.6;">
            Dear <strong>${customer.name}</strong>,
          </p>
          <p style="font-size: 15px; line-height: 1.6; color: #444444;">
            We noticed that the checkout payment attempt for your order <strong>${order.orderNumber}</strong> was not successful. Your reservation is still secure on hold temporarily, but action is required to complete your order.
          </p>
          
          <div style="background-color: #fff8f8; border-radius: 8px; padding: 20px; margin: 24px 0; border: 1px solid rgba(220, 53, 69, 0.05); font-size: 14px;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 4px 0; color: #777777;">Order Number:</td>
                <td style="padding: 4px 0; text-align: right; font-weight: 600; color: #333;">${order.orderNumber}</td>
              </tr>
              <tr>
                <td style="padding: 4px 0; color: #777777;">Amount:</td>
                <td style="padding: 4px 0; text-align: right; font-weight: 600; color: #333;">${totalStr}</td>
              </tr>
              <tr>
                <td style="padding: 4px 0; color: #777777;">Status:</td>
                <td style="padding: 4px 0; text-align: right; font-weight: 600; color: #dc3545;">FAILED</td>
              </tr>
              ${errorMsg ? `
              <tr>
                <td style="padding: 4px 0; color: #777777;">Details:</td>
                <td style="padding: 4px 0; text-align: right; color: #666; font-style: italic;">${errorMsg}</td>
              </tr>` : ''}
            </table>
          </div>

          <p style="font-size: 14px; line-height: 1.6; color: #666;">
            Please click below to try initiating the payment check again, or contact our support team immediately so we can assist you with alternative checkout methods before the hold reservation expires.
          </p>

          <div style="text-align: center; margin-top: 32px;">
            <a href="${siteUrl}/dashboard" style="display: inline-block; background-color: #dc3545; color: #ffffff; text-decoration: none; padding: 12px 24px; font-weight: 600; font-size: 14px; border-radius: 30px;">Retry Payment from Dashboard</a>
          </div>
        </div>
        
        <!-- Footer -->
        <div style="background-color: #F8F4F6; padding: 24px; text-align: center; font-size: 12px; color: #888888; border-top: 1px solid rgba(117, 85, 102, 0.05);">
          <p style="margin: 0 0 8px 0;">Jawhara OS</p>
          <p style="margin: 0;">Need help? Reply to this email or chat with us instantly on WhatsApp.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to: customer.email,
    subject: `Payment Attempt Failed - ${order.orderNumber} - Jawhara`,
    html,
  });
}

/**
 * Sends a summary notification email to the admin regarding new orders or reservations
 */
export async function sendAdminNotificationEmail(
  adminEmail: string,
  type: 'ORDER_PAID' | 'RESERVATION_CREATED',
  details: {
    orderNumber?: string;
    amount?: number;
    customerName: string;
    customerEmail?: string;
    productName?: string;
    productCode?: string;
    dashboardLink: string;
  }
) {
  const subject = type === 'ORDER_PAID'
    ? `[ALERT] New Order Paid: ${details.orderNumber} - ${details.customerName}`
    : `[ALERT] New Hold Request: ${details.productName} by ${details.customerName}`;

  const summaryTitle = type === 'ORDER_PAID'
    ? 'New Paid Order Received!'
    : 'New Hold Request (Reservation) Placed!';

  const detailsHtml = type === 'ORDER_PAID'
    ? `
    <p><strong>Order Number:</strong> ${details.orderNumber}</p>
    <p><strong>Amount Paid:</strong> ${details.amount?.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}</p>
    `
    : `
    <p><strong>Product Name:</strong> ${details.productName}</p>
    <p><strong>Product Code:</strong> ${details.productCode}</p>
    `;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Boutique Alert</title>
    </head>
    <body style="font-family: sans-serif; background-color: #f4f4f4; margin: 0; padding: 30px; color: #333333;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; border: 1px solid #dddddd;">
        <div style="background-color: #755566; color: #ffffff; padding: 24px; text-align: center;">
          <h2 style="margin: 0; font-size: 20px;">Boutique Alert Notifications</h2>
        </div>
        <div style="padding: 24px; line-height: 1.6; font-size: 14px;">
          <h3 style="color: #755566; margin-top: 0; font-size: 18px;">${summaryTitle}</h3>
          
          <div style="background-color: #fdfdfd; border: 1px solid #f0f0f0; border-radius: 6px; padding: 16px; margin: 20px 0;">
            ${detailsHtml}
            <p><strong>Customer:</strong> ${details.customerName} (${details.customerEmail || 'Guest'})</p>
            <p><strong>Time:</strong> ${new Date().toLocaleString('en-IN')}</p>
          </div>
          
          <div style="text-align: center; margin-top: 30px;">
            <a href="${details.dashboardLink}" style="display: inline-block; background-color: #755566; color: #ffffff; text-decoration: none; padding: 12px 24px; font-weight: bold; border-radius: 4px;">Open Admin Dashboard</a>
          </div>
        </div>
        <div style="background-color: #eeeeee; text-align: center; padding: 12px; font-size: 11px; color: #777777;">
          Jawhara OS Alerts · Automated Message
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to: adminEmail,
    subject,
    html,
  });
}
