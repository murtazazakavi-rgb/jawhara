import { RazorpayPaymentClient, PaymentLinkOptions, PaymentLinkResponse } from './razorpay';
import crypto from 'crypto';
import { mockPaymentsAreAllowed } from '@/lib/security/payments';

class MockPaymentClient {
  async createPaymentLink(options: PaymentLinkOptions): Promise<PaymentLinkResponse> {
    const mockLinkId = `plink_${crypto.randomBytes(8).toString('hex')}`;
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://jawhara-os.vercel.app';
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
  const provider = process.env.PAYMENT_PROVIDER;
  const hasRazorpayCreds = !!process.env.RAZORPAY_KEY_ID && !!process.env.RAZORPAY_KEY_SECRET;

  if (provider === 'razorpay') {
    if (!hasRazorpayCreds) {
      return { success: false, error: 'Razorpay is not fully configured.' };
    }
    const client = new RazorpayPaymentClient();
    return client.createPaymentLink(options);
  }

  if (provider === 'mock' && mockPaymentsAreAllowed()) {
    const client = new MockPaymentClient();
    return client.createPaymentLink(options);
  }

  console.error('Payment link creation blocked: no enabled payment provider is configured.');
  return { success: false, error: 'Online payments are temporarily unavailable.' };
}
