import { sendWhatsAppMessage } from '../lib/integrations/whatsapp/provider';
import fs from 'fs';
import path from 'path';

// Load .env
try {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    for (const line of envContent.split('\n')) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
        const [key, ...rest] = trimmed.split('=');
        const val = rest.join('=').replace(/^["']|["']$/g, '');
        if (key && val) {
          process.env[key.trim()] = val.trim();
        }
      }
    }
  }
} catch (e) {}

async function testLiveSend() {
  console.log('Testing live WhatsApp message dispatch via Evolution Go...');
  console.log(`Provider: ${process.env.WHATSAPP_PROVIDER}`);
  console.log(`API URL: ${process.env.EVOLUTION_API_URL}`);

  const res = await sendWhatsAppMessage({
    to: '917016527673',
    type: 'text',
    text: {
      body: '🎉 *Jawhara OS — WhatsApp Integration Live!* 🛍️\n\nYour WhatsApp instance is successfully connected. Order confirmations and boutique customer inquiries will now be delivered automatically in real-time.',
    },
  });

  console.log('Dispatch result:', res);
  if (!res.success) {
    throw new Error(`Failed to send WhatsApp message: ${res.error}`);
  }
  console.log('✓ Live message dispatched successfully!');
}

testLiveSend().catch((err) => {
  console.error('Error testing live send:', err);
  process.exit(1);
});
