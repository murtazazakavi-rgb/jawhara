import { MetaWhatsAppClient } from './meta';
import { WhatsAppSendMessageOptions, WhatsAppSendMessageResponse } from './types';
import crypto from 'crypto';

class MockWhatsAppClient {
  async sendMessage(options: WhatsAppSendMessageOptions): Promise<WhatsAppSendMessageResponse> {
    const mockId = `wamid.HBgL${crypto.randomBytes(8).toString('hex').toUpperCase()}`;
    console.log('--- [MOCK WHATSAPP OUTBOUND] ---');
    console.log(`To: ${options.to}`);
    console.log(`Type: ${options.type}`);
    if (options.type === 'text') console.log(`Body: ${options.text?.body}`);
    if (options.type === 'template') console.log(`Template: ${options.template?.name} (Language: ${options.template?.language.code})`);
    if (options.type === 'image') console.log(`Image Link: ${options.image?.link} (Caption: ${options.image?.caption})`);
    console.log(`Generated Mock Provider Message ID: ${mockId}`);
    console.log('---------------------------------');
    
    return {
      success: true,
      providerMessageId: mockId,
    };
  }
}

/**
 * Sends a message via the configured WhatsApp provider (Meta vs. Mock).
 */
export async function sendWhatsAppMessage(
  options: WhatsAppSendMessageOptions
): Promise<WhatsAppSendMessageResponse> {
  const provider = process.env.WHATSAPP_PROVIDER || 'mock';
  const hasMetaCreds = !!process.env.META_WHATSAPP_ACCESS_TOKEN && !!process.env.META_WHATSAPP_PHONE_NUMBER_ID;

  if (provider === 'meta' && !hasMetaCreds) {
    console.error('ERROR: WHATSAPP_PROVIDER is set to "meta" but credentials are missing in env. Falling back to mock.');
  }

  const useMeta = provider === 'meta' && hasMetaCreds;

  if (useMeta) {
    const client = new MetaWhatsAppClient();
    return client.sendMessage(options);
  } else {
    const client = new MockWhatsAppClient();
    return client.sendMessage(options);
  }
}
