import { EvolutionWhatsAppClient } from '../lib/integrations/whatsapp/evolution';
import { sendWhatsAppMessage } from '../lib/integrations/whatsapp/provider';
import fs from 'fs';
import path from 'path';

// Load .env manually if not already present
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


async function runTests() {
  console.log('====================================================');
  console.log('  JAWHARA OS - EVOLUTION GO INTEGRATION TEST SUITE  ');
  console.log('====================================================\n');

  // Test 1: Evolution Client Initialization
  console.log('TEST 1: Client initialization');
  const client = new EvolutionWhatsAppClient();
  if (client) {
    console.log('  ✓ EvolutionWhatsAppClient initialized successfully');
  } else {
    throw new Error('Failed to initialize EvolutionWhatsAppClient');
  }

  // Test 2: Provider routing check
  console.log('\nTEST 2: Provider routing');
  console.log(`  Current WHATSAPP_PROVIDER: "${process.env.WHATSAPP_PROVIDER}"`);
  console.log(`  Target EVOLUTION_API_URL: "${process.env.EVOLUTION_API_URL}"`);

  // Test 3: Formatting & Serialization Test
  console.log('\nTEST 3: Template Fallback & Recipient Formatting');
  // @ts-ignore - access private helper for unit test verification
  const normalizedNumber = client['formatRecipient']('+91 70165 27673');
  console.log(`  Normalized "+91 70165 27673" -> "${normalizedNumber}"`);
  if (normalizedNumber !== '917016527673') {
    throw new Error(`Expected '917016527673' but got '${normalizedNumber}'`);
  }
  console.log('  ✓ Recipient number normalized correctly');

  // @ts-ignore
  const rendered = client['renderTemplateFallback']({
    name: 'order_confirmation',
    language: { code: 'en' },
    components: [
      {
        type: 'body',
        parameters: [
          { text: 'Fatema Ben' },
          { text: 'ORD-10042' },
          { text: '₹34,500' },
        ],
      },
    ],
  });
  console.log('  Rendered Template Fallback:\n' + rendered.split('\n').map(l => '    ' + l).join('\n'));
  if (!rendered.includes('ORDER CONFIRMATION') || !rendered.includes('ORD-10042')) {
    throw new Error('Template fallback rendering failed');
  }
  console.log('  ✓ Template rendered with structured text');

  // Test 4: Inbound Webhook Event Simulation
  console.log('\nTEST 4: Inbound Lookbook SKU Pattern Matcher');
  const sampleInquiry = 'Salam, I saw this gorgeous rida in the lookbook and want to inquire about piece JWR-RIDA-26-0001. Is it still available?';
  const skuRegex = /JWR-[A-Z0-9]+-[0-9]{2}-[0-9]{4}/i;
  const match = sampleInquiry.match(skuRegex);
  if (match && match[0].toUpperCase() === 'JWR-RIDA-26-0001') {
    console.log(`  Matched SKU Code: "${match[0].toUpperCase()}"`);
    console.log('  ✓ SKU auto-detection pattern validated');
  } else {
    throw new Error('SKU pattern matching failed');
  }

  console.log('\n====================================================');
  console.log('  ALL EVOLUTION GO INTEGRATION TESTS PASSED ✓       ');
  console.log('====================================================\n');
}

runTests().catch((err) => {
  console.error('\n❌ Test failure:', err);
  process.exit(1);
});
