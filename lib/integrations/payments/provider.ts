import { RazorpayPaymentClient, PaymentLinkOptions, PaymentLinkResponse } from './razorpay';
import crypto from 'crypto';
import { headers } from 'next/headers';

class MockPaymentClient {
  async createPaymentLink(options: PaymentLinkOptions): Promise<PaymentLinkResponse> {
    const mockLinkId = `plink_${crypto.randomBytes(8).toString('hex')}`;
    const host = (await headers()).get('host') || 'localhost:3000';
    const protocol = host.startsWith('localhost') ? 'http' : 'https';
    const siteUrl = `${protocol}://${host}`;
    const mockShortUrl = `${siteUrl}/api/public/pay-mock/${mockLinkId}`;

    console.log('--- [MOCK PAYMENT LINK OUTBOUND] ---');
    console.log(`OrderId: ${options.orderId}`);
    console.log(`OrderNum: ${options.orderNumber}`);
    console.log(`Amount: ₹${options.amount}`);
    console.log(`Customer: ${options.customerName} (${options.customerMobile})`);
    console.log(`Mock URL: ${mockShortUrl}`);
    console.log('------------------------------------');

    return {
      success: true,
      providerPaymentLinkId: mockLinkId,
      shortUrl: mockShortUrl,
    };
  }
}

/**
 * Creates a payment link via the configured payment provider (Razorpay vs. Mock).
 */
export async function createPaymentLink(
  options: PaymentLinkOptions
): Promise<PaymentLinkResponse> {
  const provider = process.env.PAYMENT_PROVIDER || 'mock';
  const hasRazorpayCreds = !!process.env.RAZORPAY_KEY_ID && !!process.env.RAZORPAY_KEY_SECRET;

  const useRazorpay = provider === 'razorpay' && hasRazorpayCreds;

  if (useRazorpay) {
    const client = new RazorpayPaymentClient();
    return client.createPaymentLink(options);
  } else {
    const client = new MockPaymentClient();
    return client.createPaymentLink(options);
  }
}
