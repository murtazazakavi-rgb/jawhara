import { GoogleGenAI } from '@google/genai';

export interface AISuggestions {
  categoryName?: string;
  name: string;
  shortDesc: string;
  description: string;
  primaryColour: string;
  secondaryColours: string;
  suggestedPrice?: number;
  attributes: {
    pardi_style?: string;
    embroidery_type?: string;
    fabric?: string;
    top_colour?: string;
    bottom_colour?: string;
    bed_size?: string;
    material?: string;
  };
}

export async function suggestProductDetails(
  imageUrl: string,
  categoryName?: string
): Promise<AISuggestions> {
  const apiKey = process.env.GEMINI_API_KEY;

  // Mock Fallback if API key is not configured
  if (!apiKey) {
    console.log('Gemini API key not configured. Triggering intelligent fallback.');
    
    return {
      categoryName: categoryName || 'Rida',
      name: 'Mehr-e-Bahar Rida',
      shortDesc: 'A graceful pastel floral Rida featuring intricate scalloped lace and eyelet embroidery',
      description: 'Handcrafted with meticulous attention to detail, this piece showcases a harmonious blend of refined fabric and intricate embroidery. Elaborate scalloped laces and eyelet borders cascade gracefully along the hem, lending an air of timeless sophistication and gentle grace.',
      primaryColour: 'Dusty Rose Pink',
      secondaryColours: 'Mint Green, Pearl White',
      suggestedPrice: 4200,
      attributes: {
        pardi_style: 'Floral Motif with Scalloped Lace',
        embroidery_type: 'Threadwork & Chikankari Eyelet',
        fabric: 'Cotton Silk',
        top_colour: 'Dusty Rose Pink',
        bottom_colour: 'Pastel Pink',
        bed_size: 'Queen',
        material: '100% Linen',
      },
    };
  }

  // Initialize new SDK client
  const ai = new GoogleGenAI({ apiKey });

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
    You are an expert luxury bespoke fashion copywriter and master merchandiser for a prestigious boutique named "Jawhara" (specializing in custom luxury Ridas, bespoke attire, bedding, and handcrafted home décor).
    
    Carefully inspect the attached product photograph.
    ${categoryName ? `Target category: "${categoryName}".` : 'Determine the boutique category from the image (e.g. "Rida", "Bedding", "Décor", "Kids").'}
    
    Extract and generate the following detailed boutique specifications:
    1. categoryName: The detected category ("Rida", "Bedding", "Décor", or "Kids").
    2. name: A poetic, graceful boutique name (e.g. "Mehr-e-Bahar Rida", "Noor-e-Jahan", "Gulnaar Edit", "Zariyah Ensemble", "Shafaq Silk").
    3. shortDesc: One elegant, editorial sentence (e.g. "A graceful pastel floral Rida featuring intricate scalloped lace borders and fine eyelet embroidery").
    4. description: A sensory, high-end editorial lookbook description. Describe the fabric texture, weight, drape, embroidery craftsmanship, and occasion.
    5. primaryColour: The dominant color (e.g. "Dusty Rose Pink", "Sage Green", "Ivory", "Powder Blue").
    6. secondaryColours: Accent colors comma-separated (e.g. "Mint Green, Gold Zari, Off-White").
    7. suggestedPrice: An estimated retail price in INR (integer, e.g. 3800 to 7500 for bespoke Ridas).
    8. attributes:
       - fabric: Identify the fabric weave precisely (e.g. "Cotton Silk", "French Chiffon", "Georgette", "Organza", "Linen", "Pure Cotton").
       - embroidery_type: Specific craft technique (e.g. "Threadwork & Chikankari Eyelet", "Zardozi & Pearl Work", "Scalloped Lace Border", "Floral Applique").
       - pardi_style: The pardi design (e.g. "Floral Motif with Scalloped Lace", "Geometric Lace Border", "Cutwork Border", "Solid Contrast Border").
       - top_colour: Top/kurti or upper section color.
       - bottom_colour: Bottom/lehenga or skirt section color.
       - material: For bedding/decor (e.g. "Egyptian Cotton", "Silk Velvet").
       - bed_size: For bedding ("Single", "Double", "Queen", "King").
  `;

  const modelsToTry = [
    process.env.GEMINI_MODEL,
    'gemini-3.6-flash',
    'gemini-2.0-flash',
    'gemini-1.5-flash'
  ].filter((m): m is string => !!m);

  // Remove duplicates while keeping order
  const uniqueModels = Array.from(new Set(modelsToTry));

  const errors: string[] = [];
  for (const model of uniqueModels) {
    try {
      console.log(`Generating product suggestions using model: ${model}`);
      const response = await ai.models.generateContent({
        model: model,
        contents: [prompt, ...imageParts],
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'OBJECT',
            properties: {
              categoryName: { type: 'STRING' },
              name: { type: 'STRING' },
              shortDesc: { type: 'STRING' },
              description: { type: 'STRING' },
              primaryColour: { type: 'STRING' },
              secondaryColours: { type: 'STRING' },
              suggestedPrice: { type: 'NUMBER' },
              attributes: {
                type: 'OBJECT',
                properties: {
                  pardi_style: { type: 'STRING' },
                  embroidery_type: { type: 'STRING' },
                  fabric: { type: 'STRING' },
                  top_colour: { type: 'STRING' },
                  bottom_colour: { type: 'STRING' },
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
    } catch (err: any) {
      const errMsg = err.message || JSON.stringify(err);
      console.warn(`Gemini model ${model} failed:`, errMsg);
      errors.push(`${model}: ${errMsg}`);
    }
  }

  throw new Error(`All Gemini models failed. Details: [${errors.join(' | ')}]`);
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
  const modelName = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

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

  const modelsToTry = [
    process.env.GEMINI_MODEL,
    'gemini-3.6-flash',
    'gemini-2.0-flash',
    'gemini-1.5-flash'
  ].filter((m): m is string => !!m);

  const uniqueModels = Array.from(new Set(modelsToTry));

  let lastError: any = null;
  for (const model of uniqueModels) {
    try {
      console.log(`Generating reply suggestions using model: ${model}`);
      const response = await ai.models.generateContent({
        model: model,
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
    } catch (err: any) {
      console.warn(`Gemini model ${model} failed for suggestions:`, err.message || err);
      lastError = err;
    }
  }

  throw lastError || new Error('All configured Gemini models failed for suggestions.');
}

