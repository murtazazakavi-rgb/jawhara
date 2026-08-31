import { PriceTagProduct } from '@/components/PriceTag';

export interface PrintTagItem {
  product: PriceTagProduct;
  quantity?: number;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function generateTagInnerHtml(product: PriceTagProduct, baseUrl: string): string {
  const categoryName = typeof product.category === 'string'
    ? product.category
    : product.category?.name || 'Exclusive';
    
  const qrUrl = `${baseUrl}/p/${product.slug}`;
  const qrCodeSrc = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(qrUrl)}`;
  const formattedPrice = Number(product.price).toLocaleString('en-IN');

  return `
    <div class="price-tag">
      <!-- Header -->
      <div class="tag-header">
        <span class="tag-brand">JAWHARA</span>
        <span class="tag-code">${escapeHtml(product.productCode || 'JWR-001')}</span>
      </div>

      <!-- Middle Body -->
      <div class="tag-body">
        <div class="tag-qr">
          <img src="${qrCodeSrc}" alt="QR" crossorigin="anonymous" />
        </div>
        <div class="tag-info">
          <div class="tag-name">${escapeHtml(product.name)}</div>
          <div class="tag-detail">Category: ${escapeHtml(categoryName)}</div>
          ${product.primaryColour ? `<div class="tag-detail">Colour: ${escapeHtml(product.primaryColour)}</div>` : ''}
        </div>
      </div>

      <!-- Footer -->
      <div class="tag-footer">
        <span class="tag-tagline">HANDCRAFTED LUXURY</span>
        <span class="tag-price">&#8377;${formattedPrice}</span>
      </div>
    </div>
  `;
}

export function printPriceTags(
  items: PrintTagItem[],
  layout: 'thermal' | 'sheet' = 'thermal',
  origin?: string
) {
  if (typeof window === 'undefined') return;

  const baseUrl = origin || window.location.origin || 'https://jawhara-os.vercel.app';

  // Expand quantities
  const expanded: PriceTagProduct[] = [];
  items.forEach(({ product, quantity = 1 }) => {
    const qty = Math.max(1, quantity);
    for (let i = 0; i < qty; i++) {
      expanded.push(product);
    }
  });

  if (expanded.length === 0) return;

  const tagsHtml = layout === 'thermal'
    ? expanded.map(p => `<div class="thermal-page">${generateTagInnerHtml(p, baseUrl)}</div>`).join('\n')
    : `<div class="sheet-grid">${expanded.map(p => `<div class="sheet-cell">${generateTagInnerHtml(p, baseUrl)}</div>`).join('\n')}</div>`;

  const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Jawhara Price Tags (${expanded.length})</title>
  <style>
    @page {
      ${layout === 'thermal' 
        ? 'size: 2.5in 1.5in; margin: 0;' 
        : 'size: A4 portrait; margin: 8mm;'
      }
    }
    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    html, body {
      margin: 0;
      padding: 0;
      background: #ffffff;
      color: #000000;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    ${layout === 'thermal' ? `
      .thermal-page {
        width: 2.5in;
        height: 1.5in;
        max-width: 2.5in;
        max-height: 1.5in;
        page-break-after: always;
        break-after: page;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 2px;
        box-sizing: border-box;
        overflow: hidden;
      }
      .thermal-page:last-child {
        page-break-after: auto;
        break-after: auto;
      }
    ` : `
      .sheet-grid {
        display: grid;
        grid-template-columns: repeat(2, 2.5in);
        gap: 12px;
        justify-content: center;
        padding: 4px;
      }
      .sheet-cell {
        width: 2.5in;
        height: 1.5in;
        break-inside: avoid;
        page-break-inside: avoid;
        box-sizing: border-box;
      }
    `}

    .price-tag {
      width: 2.5in;
      height: 1.5in;
      max-width: 2.5in;
      max-height: 1.5in;
      box-sizing: border-box;
      padding: 7px 9px;
      border: 1.5px dashed #222222;
      border-radius: 4px;
      background: #ffffff;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      overflow: hidden;
    }

    .tag-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1.5px solid #000000;
      padding-bottom: 2px;
    }

    .tag-brand {
      font-family: "Cinzel", "Playfair Display", Georgia, serif;
      font-weight: 800;
      font-size: 11px;
      letter-spacing: 2px;
      text-transform: uppercase;
      color: #000000;
      line-height: 1;
    }

    .tag-code {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-weight: 700;
      font-size: 8px;
      background: #000000;
      color: #ffffff;
      padding: 1px 4px;
      border-radius: 2px;
      letter-spacing: 0.5px;
      line-height: 1.2;
    }

    .tag-body {
      display: flex;
      align-items: center;
      gap: 7px;
      flex: 1;
      padding: 3px 0;
      min-height: 0;
    }

    .tag-qr {
      width: 44px;
      height: 44px;
      flex-shrink: 0;
      border: 1px solid #d0d0d0;
      padding: 1.5px;
      border-radius: 2px;
      background: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .tag-qr img {
      width: 100%;
      height: 100%;
      object-fit: contain;
      display: block;
    }

    .tag-info {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }

    .tag-name {
      font-weight: 700;
      font-size: 9px;
      line-height: 1.2;
      color: #000000;
      overflow: hidden;
      text-overflow: ellipsis;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
    }

    .tag-detail {
      font-size: 7.5px;
      color: #444444;
      margin-top: 1.5px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      line-height: 1.2;
    }

    .tag-footer {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      border-top: 1.5px solid #000000;
      padding-top: 2px;
    }

    .tag-tagline {
      font-size: 6px;
      font-weight: 700;
      letter-spacing: 1.2px;
      color: #555555;
      text-transform: uppercase;
      line-height: 1;
    }

    .tag-price {
      font-weight: 800;
      font-size: 12px;
      color: #000000;
      line-height: 1;
    }
  </style>
</head>
<body>
  ${tagsHtml}
</body>
</html>`;

  // Hidden print iframe
  let iframe = document.getElementById('jawhara-print-iframe') as HTMLIFrameElement;
  if (!iframe) {
    iframe = document.createElement('iframe');
    iframe.id = 'jawhara-print-iframe';
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.style.zIndex = '-9999';
    iframe.style.visibility = 'hidden';
    document.body.appendChild(iframe);
  }

  const iframeDoc = iframe.contentWindow?.document || iframe.contentDocument;
  if (!iframeDoc) return;

  iframeDoc.open();
  iframeDoc.write(fullHtml);
  iframeDoc.close();

  // Give browser time to render images then invoke print dialog
  const printTrigger = () => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch (err) {
      console.error('Print trigger error:', err);
    }
  };

  // Wait for images in the iframe to finish loading
  const images = iframeDoc.getElementsByTagName('img');
  let loadedCount = 0;
  const totalImages = images.length;

  if (totalImages === 0) {
    setTimeout(printTrigger, 300);
  } else {
    const checkDone = () => {
      loadedCount++;
      if (loadedCount >= totalImages) {
        setTimeout(printTrigger, 200);
      }
    };

    for (let i = 0; i < totalImages; i++) {
      const img = images[i];
      if (img.complete) {
        checkDone();
      } else {
        img.onload = checkDone;
        img.onerror = checkDone;
      }
    }

    // Safety timeout in case an image hangs
    setTimeout(printTrigger, 1000);
  }
}
