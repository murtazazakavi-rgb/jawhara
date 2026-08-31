'use client';

import React from 'react';

export interface PriceTagProduct {
  id: string;
  name: string;
  productCode: string;
  price: number | any;
  slug: string;
  category?: { name: string } | string;
  primaryColour?: string | null;
}

interface PriceTagProps {
  product: PriceTagProduct;
  origin?: string;
  className?: string;
}

export default function PriceTag({ product, origin = '', className = '' }: PriceTagProps) {
  const categoryName = typeof product.category === 'string' 
    ? product.category 
    : product.category?.name || 'Exclusive';
    
  const baseUrl = origin || (typeof window !== 'undefined' ? window.location.origin : 'https://jawhara-os.vercel.app');
  const qrUrl = `${baseUrl}/p/${product.slug}`;
  const qrCodeSrc = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(qrUrl)}`;

  return (
    <div 
      className={`w-[2.5in] h-[1.5in] max-w-[2.5in] max-h-[1.5in] p-2 bg-white text-black font-sans border border-dashed border-gray-400 rounded-md flex flex-col justify-between box-border overflow-hidden select-none shadow-xs ${className}`}
      style={{ width: '2.5in', height: '1.5in' }}
    >
      {/* Header */}
      <div className="flex justify-between items-start border-b border-black pb-0.5">
        <span className="font-serif font-bold text-xs tracking-widest uppercase leading-none">
          JAWHARA
        </span>
        <span className="font-mono font-bold text-[8px] bg-black text-white px-1 py-0.2 rounded-xs leading-tight">
          {product.productCode}
        </span>
      </div>

      {/* Middle Body */}
      <div className="flex gap-2 items-center flex-grow py-0.5 min-h-0">
        {/* QR Code */}
        <div className="w-11 h-11 shrink-0 bg-white border border-gray-200 p-0.5 rounded-xs flex items-center justify-center">
          <img
            src={qrCodeSrc}
            alt={`QR ${product.productCode}`}
            className="w-full h-full object-contain"
            crossOrigin="anonymous"
          />
        </div>

        {/* Product Details */}
        <div className="flex-grow flex flex-col justify-center min-w-0 leading-tight">
          <span className="font-bold text-[9px] text-black line-clamp-2 leading-tight">
            {product.name}
          </span>
          <span className="text-[7.5px] text-gray-700 capitalize truncate mt-0.5">
            Category: {categoryName}
          </span>
          {product.primaryColour && (
            <span className="text-[7.5px] text-gray-700 truncate">
              Colour: {product.primaryColour}
            </span>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="flex justify-between items-baseline border-t border-black pt-0.5">
        <span className="text-[6px] text-gray-500 font-bold tracking-wider uppercase">
          Handcrafted Luxury
        </span>
        <span className="font-bold text-xs text-black">
          ₹{Number(product.price).toLocaleString('en-IN')}
        </span>
      </div>
    </div>
  );
}
