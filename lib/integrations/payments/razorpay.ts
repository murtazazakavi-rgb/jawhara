import { headers } from 'next/headers';

export interface PaymentLinkOptions {
  orderId: string;
  orderNumber: string;
  amount: number; // in Rupees
  customerName: string;
  customerMobile: string;
  customerEmail?: string;
  expiresInMinutes: number;
}

export interface PaymentLinkResponse {
  success: boolean;
  providerPaymentLinkId?: string;
  shortUrl?: string;
  error?: string;
}

export class RazorpayPaymentClient {
  private keyId: string;
  private keySecret: string;

  constructor() {
    this.keyId = process.env.RAZORPAY_KEY_ID || '';
    this.keySecret = process.env.RAZORPAY_KEY_SECRET || '';
  }

  private isConfigured(): boolean {
    return !!this.keyId && !!this.keySecret;
  }

  async createPaymentLink(options: PaymentLinkOptions): Promise<PaymentLinkResponse> {
    if (!this.isConfigured()) {
      console.warn('Razorpay API keys are not fully configured.');
      return { success: false, error: 'Integration credentials missing.' };
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://jawhara-os.vercel.app';

    const url = 'https://api.razorpay.com/v1/payment_links';
    
    // Convert to paise (minor units)
    const amountInPaise = Math.round(options.amount * 100);
    const expireBy = Math.floor(Date.now() / 1000) + options.expiresInMinutes * 60;
    
    // Normalize phone number (strip '+' for Razorpay contact field if needed)
    const contact = options.customerMobile.replace('+', '');

    const body = {
      amount: amountInPaise,
      currency: 'INR',
      accept_partial: false,
      expire_by: expireBy,
      reference_id: options.orderId,
      description: `Payment for Order ${options.orderNumber} - Jawhara OS`,
      customer: {
        name: options.customerName,
        contact: contact,
        email: options.customerEmail || undefined,
      },
      notify: {
        sms: false,
        email: false,
      },
      reminder_enable: true,
      callback_url: `${siteUrl}/orders/${options.orderId}/receipt`,
      callback_method: 'get',
    };

    const authHeader = 'Basic ' + Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64');

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('Razorpay API error response:', data);
        return {
          success: false,
          error: data?.error?.description || 'Razorpay link creation failed',
        };
      }

      return {
        success: true,
        providerPaymentLinkId: data.id,
        shortUrl: data.short_url,
      };
    } catch (err: any) {
      console.error('Razorpay API network error:', err);
      return {
        success: false,
        error: err.message || 'Network error connecting to Razorpay API',
      };
    }
  }
}
