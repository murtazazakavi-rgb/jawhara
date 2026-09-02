import { WhatsAppSendMessageOptions, WhatsAppSendMessageResponse } from './types';

export class EvolutionWhatsAppClient {
  private apiUrl: string;
  private apiKey: string;
  private instanceName: string;
  private cachedToken: string | null = null;
  private tokenExpiresAt: number = 0;

  constructor() {
    const rawUrl = process.env.EVOLUTION_API_URL || '';
    // If in production and URL is localhost or missing, fallback to live Render instance
    if ((!rawUrl || rawUrl.includes('localhost')) && (process.env.NODE_ENV === 'production' || process.env.VERCEL)) {
      this.apiUrl = 'https://evolution-go-latest-uaa3.onrender.com';
    } else {
      this.apiUrl = (rawUrl || 'https://evolution-go-latest-uaa3.onrender.com').replace(/\/+$/, '');
    }

    this.apiKey = process.env.EVOLUTION_API_KEY || 'jawhara-evolution-secret-key-2026';
    this.instanceName = process.env.EVOLUTION_INSTANCE_NAME || 'jawhara';
  }

  private isConfigured(): boolean {
    return !!this.apiUrl && !!this.apiKey;
  }

  /**
   * Resolves the active instance token.
   * If EVOLUTION_API_KEY is an instance token (UUID), returns it directly.
   * If it is the global API key, automatically fetches the token for the active instance.
   */
  private async getAuthToken(): Promise<string> {
    // If apiKey is explicitly an instance token (UUID format), use it directly
    if (this.apiKey && this.apiKey.length === 36 && this.apiKey.includes('-')) {
      return this.apiKey;
    }

    if (this.cachedToken && Date.now() < this.tokenExpiresAt) {
      return this.cachedToken;
    }

    try {
      const res = await fetch(`${this.apiUrl}/instance/all`, {
        headers: { apikey: this.apiKey },
        signal: AbortSignal.timeout(6000),
      });
      if (res.ok) {
        const json = await res.json();
        const instances = json?.data || [];
        const matched =
          instances.find((i: any) => i.name?.toLowerCase() === this.instanceName?.toLowerCase()) ||
          instances.find((i: any) => i.connected) ||
          instances[0];

        if (matched?.token) {
          this.cachedToken = matched.token;
          this.tokenExpiresAt = Date.now() + 5 * 60 * 1000; // Cache for 5 minutes
          return matched.token;
        }
      }
    } catch (e) {
      console.warn('Could not auto-fetch instance token from Evolution Go, using EVOLUTION_API_KEY:', e);
    }

    return this.apiKey;
  }

  /**
   * Normalizes phone number to digits only (E.164 without leading '+')
   * e.g. "+91 70165 27673" -> "917016527673"
   */
  private formatRecipient(to: string): string {
    return to.replace(/\D/g, '');
  }

  /**
   * Converts Meta-style template components into a human-readable text body
   * for direct sending over Evolution Go without needing Meta template registration.
   */
  private renderTemplateFallback(template: NonNullable<WhatsAppSendMessageOptions['template']>): string {
    const lines: string[] = [];
    
    // Add header/title from template name in human-friendly casing
    const title = template.name.replace(/_/g, ' ').toUpperCase();
    lines.push(`*${title}*`);
    lines.push('');

    if (template.components && Array.isArray(template.components)) {
      for (const component of template.components) {
        if (component.type === 'body' && Array.isArray(component.parameters)) {
          const values = component.parameters.map((p: any) => p.text || p.currency?.amount_1000 || '').filter(Boolean);
          if (values.length > 0) {
            lines.push(values.join(' • '));
          }
        }
      }
    }

    return lines.join('\n');
  }

  async sendMessage(options: WhatsAppSendMessageOptions): Promise<WhatsAppSendMessageResponse> {
    if (!this.isConfigured()) {
      console.warn('Evolution Go API credentials are not fully configured (EVOLUTION_API_URL or EVOLUTION_API_KEY missing).');
      return { success: false, error: 'Evolution Go credentials missing in environment.' };
    }

    const recipientNumber = this.formatRecipient(options.to);
    if (!recipientNumber) {
      return { success: false, error: 'Invalid recipient phone number.' };
    }

    const token = await this.getAuthToken();

    try {
      if (options.type === 'text' && options.text) {
        const url = `${this.apiUrl}/send/text`;
        const payload = {
          number: recipientNumber,
          text: options.text.body,
        };

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'apikey': token,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(6000),
        });

        const data = await response.json();
        if (!response.ok) {
          console.error('Evolution Go send/text error:', data);
          return { success: false, error: data?.error || data?.message || 'Evolution Go text dispatch failed.' };
        }

        const messageId = data?.data?.id || data?.id || `evo-${Date.now()}`;
        return { success: true, providerMessageId: messageId };
      }

      if (options.type === 'image' && options.image) {
        const url = `${this.apiUrl}/send/media`;
        const payload = {
          number: recipientNumber,
          type: 'image',
          url: options.image.link,
          caption: options.image.caption || '',
        };

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'apikey': token,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(6000),
        });

        const data = await response.json();
        if (!response.ok) {
          console.error('Evolution Go send/media error:', data);
          return { success: false, error: data?.error || data?.message || 'Evolution Go media dispatch failed.' };
        }

        const messageId = data?.data?.id || data?.id || `evo-${Date.now()}`;
        return { success: true, providerMessageId: messageId };
      }

      if (options.type === 'template' && options.template) {
        // Render template body and dispatch as direct text
        const renderedText = this.renderTemplateFallback(options.template);
        const url = `${this.apiUrl}/send/text`;
        const payload = {
          number: recipientNumber,
          text: renderedText,
        };

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'apikey': token,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        const data = await response.json();
        if (!response.ok) {
          console.error('Evolution Go template dispatch error:', data);
          return { success: false, error: data?.error || data?.message || 'Evolution Go template dispatch failed.' };
        }

        const messageId = data?.data?.id || data?.id || `evo-${Date.now()}`;
        return { success: true, providerMessageId: messageId };
      }

      return { success: false, error: `Unsupported message type for Evolution Go: ${options.type}` };
    } catch (err: any) {
      console.error('Evolution Go network error:', err);
      return { success: false, error: err?.message || 'Network error connecting to Evolution Go server.' };
    }
  }
}
