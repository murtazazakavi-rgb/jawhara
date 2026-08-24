import { GoogleGenAI } from '@google/genai';

export interface AISuggestions {
  name: string;
  shortDesc: string;
  description: string;
  primaryColour: string;
  secondaryColours: string;
  attributes: {
    pardi_style?: string;
    embroidery_type?: string;
    fabric?: string;
    bed_size?: string;
    material?: string;
  };
}

export async function suggestProductDetails(
  imageUrl: string,
  categoryName: string
): Promise<AISuggestions> {
  const apiKey = process.env.GEMINI_API_KEY;

  // Mock Fallback if API key is not configured
  if (!apiKey) {
    console.log('Gemini API key not configured. Triggering mock fallback.');
    
    return {
      name: categoryName === 'Rida' ? 'Mehr-e-Bahar' : 'Boutique Item',
      shortDesc: categoryName === 'Rida' ? 'A graceful pastel floral Rida' : 'A premium handcrafted piece',
      description: 'An elegant addition to the collection, featuring soft tones, premium fabric weight, and curated luxury embroidery.',
      primaryColour: categoryName === 'Rida' ? 'Blush Pink' : 'Ivory',
      secondaryColours: 'Sage Green, Cream',
      attributes: {
        pardi_style: 'Traditional Minimal',
        embroidery_type: 'Floral satin stitch',
        fabric: ' cambric cotton',
        bed_size: 'Queen',
        material: '100% Linen',
      },
    };
  }

  // Initialize new SDK client
  const ai = new GoogleGenAI({ apiKey });
  const modelName = process.env.GEMINI_MODEL || 'gemini-1.5-flash';

  // Download the image buffer to send to Gemini
  let imageParts: any[] = [];
  try {
    const response = await fetch(imageUrl);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    imageParts = [
      {
        inlineData: {
          data: buffer.toString('base64'),
          mimeType: 'image/jpeg',
        },
      },
    ];
  } catch (fetchError) {
    console.error('Failed to fetch image buffer for Gemini', fetchError);
    throw new Error('Failed to access product image');
  }

  const prompt = `
    You are an AI assistant helping a premium luxury boutique named "Jawhara" tag and describe their products.
    Analyze this product image. The category is "${categoryName}".
    
    Suggest the following details:
    1. A poetic name for the product (e.g. "Mehr-e-Gul", "Noor", "Gulnaar", "Bahar").
    2. A short description (one sentence, elegant, e.g. "A graceful sage floral Rida").
    3. A full product description in luxury fashion style (focus on texture, elegance, and premium nature).
    4. A primary colour.
    5. Secondary colours (comma-separated).
    6. Suggestions for category-specific attributes (pardi_style, embroidery_type, fabric, bed_size, material).
  `;

  const response = await ai.models.generateContent({
    model: modelName,
    contents: [prompt, ...imageParts],
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: {
          name: { type: 'STRING' },
          shortDesc: { type: 'STRING' },
          description: { type: 'STRING' },
          primaryColour: { type: 'STRING' },
          secondaryColours: { type: 'STRING' },
          attributes: {
            type: 'OBJECT',
            properties: {
              pardi_style: { type: 'STRING' },
              embroidery_type: { type: 'STRING' },
              fabric: { type: 'STRING' },
              bed_size: { type: 'STRING' },
              material: { type: 'STRING' },
            },
          },
        },
        required: ['name', 'shortDesc', 'description', 'primaryColour', 'secondaryColours', 'attributes'],
      },
    },
  });

  const responseText = response.text;
  if (!responseText) {
    throw new Error('Empty response received from Gemini.');
  }

  return JSON.parse(responseText.trim());
}

export interface AISuggestedReplies {
  option1: string; // general response
  option2: string; // product pitch
  option3: string; // hold/checkout push
}

export async function generateSuggestedReplies(
  customerContext: {
    customerName: string;
    preferredColours: string;
    priceRangePreference: string;
    reservations: any[];
    recommended: any[];
  },
  lastMessageBody: string
): Promise<AISuggestedReplies> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    console.log('Gemini API key not configured. Triggering mock replies fallback.');
    const topProd = customerContext.recommended?.[0];
    const topRes = customerContext.reservations?.[0];
    
    return {
      option1: `Dear ${customerContext.customerName}, thank you for reaching out! Let me check the availability of that style and get right back to you.`,
      option2: topProd 
        ? `Dear ${customerContext.customerName}, since you love ${customerContext.preferredColours || 'elegant design'}, I thought you might appreciate the new ${topProd.name} (Code: ${topProd.productCode}, ₹${Number(topProd.price).toLocaleString('en-IN')}) which just arrived. Shall I set it aside?`
        : `Dear ${customerContext.customerName}, our new fall collections just arrived! Let me know if you would like me to share the digital lookbook.`,
      option3: topRes
        ? `Dear ${customerContext.customerName}, just checking in to see if you have any questions about the ${topRes.product.name} currently on hold for you. Let me know if you would like me to extend the hold time or generate a checkout link!`
        : `Dear ${customerContext.customerName}, would you like me to create a custom payment link for your latest order to secure the pieces?`,
    };
  }

  const ai = new GoogleGenAI({ apiKey });
  const modelName = process.env.GEMINI_MODEL || 'gemini-1.5-flash';

  const prompt = `
    You are an elite boutique sales co-pilot for "Jawhara".
    Help the salesperson draft 3 message options for the customer on WhatsApp.
    
    Customer Profile:
    - Name: ${customerContext.customerName}
    - Last Message received: "${lastMessageBody || '(None - check in warmly)'}"
    - Customer Preferred Colors: ${customerContext.preferredColours || 'Not analyzed'}
    - Customer Price Tier Preference: ${customerContext.priceRangePreference}
    - Customer Active Reservations: ${JSON.stringify(customerContext.reservations.map(r => ({ name: r.product.name, code: r.product.productCode })))}
    - Available Products we recommend pitching: ${JSON.stringify(customerContext.recommended.map(p => ({ name: p.name, code: p.productCode, price: p.price })))}
    
    Generate exactly 3 reply drafts:
    Option 1: Friendly greeting / general answering customer query. Keep it warm, polite, and brief.
    Option 2: Personal shopper pitch. Recommend one of the recommended available products that matches their preferred colors.
    Option 3: Hold / Checkout push. Politely prompt them about any active hold reservation or suggest completing payment for an unpaid checkout link.
    
    Style: Boutiquey, elegant, warm, using simple WhatsApp markdown (e.g. *bold*). Do not use placeholders like [Price] or [Link], use the actual values provided or generic friendly text.
  `;

  const response = await ai.models.generateContent({
    model: modelName,
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: {
          option1: { type: 'STRING' },
          option2: { type: 'STRING' },
          option3: { type: 'STRING' },
        },
        required: ['option1', 'option2', 'option3'],
      },
    },
  });

  const responseText = response.text;
  if (!responseText) {
    throw new Error('Empty response received from Gemini for suggestions.');
  }

  return JSON.parse(responseText.trim());
}

