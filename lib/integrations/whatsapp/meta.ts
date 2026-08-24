import { WhatsAppSendMessageOptions, WhatsAppSendMessageResponse } from './types';

export class MetaWhatsAppClient {
  private accessToken: string;
  private phoneNumberId: string;
  private apiVersion: string;

  constructor() {
    this.accessToken = process.env.META_WHATSAPP_ACCESS_TOKEN || '';
    this.phoneNumberId = process.env.META_WHATSAPP_PHONE_NUMBER_ID || '';
    this.apiVersion = process.env.META_GRAPH_API_VERSION || 'v20.0';
  }

  private isConfigured(): boolean {
    return !!this.accessToken && !!this.phoneNumberId;
  }

  async sendMessage(options: WhatsAppSendMessageOptions): Promise<WhatsAppSendMessageResponse> {
    if (!this.isConfigured()) {
      console.warn('Meta WhatsApp Cloud API credentials are not fully configured.');
      return { success: false, error: 'Integration credentials missing.' };
    }

    const url = `https://graph.facebook.com/${this.apiVersion}/${this.phoneNumberId}/messages`;
    
    // Normalize phone number (strip '+' for Meta API)
    const to = options.to.replace('+', '');

    const body: any = {
      messaging_product: 'whatsapp',
      to,
      type: options.type,
    };

    if (options.type === 'text' && options.text) {
      body.text = { body: options.text.body };
    } else if (options.type === 'template' && options.template) {
      body.template = {
        name: options.template.name,
        language: {
          code: options.template.language.code || 'en',
        },
        components: options.template.components || [],
      };
    } else if (options.type === 'image' && options.image) {
      body.image = {
        link: options.image.link,
        caption: options.image.caption,
      };
    } else {
      return { success: false, error: `Unsupported message type: ${options.type}` };
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const responseData = await response.json();

      if (!response.ok) {
        console.error('Meta API response error:', responseData);
        return {
          success: false,
          error: responseData?.error?.message || 'Meta API request failed',
        };
      }

      const messageId = responseData?.messages?.[0]?.id;
      return {
        success: true,
        providerMessageId: messageId,
      };
    } catch (err: any) {
      console.error('Meta API network error:', err);
      return {
        success: false,
        error: err.message || 'Network error connecting to Meta API',
      };
    }
  }
}
