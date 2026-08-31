'use client';

import React, { useState } from 'react';
import Image from 'next/image';

interface ProductImageGalleryProps {
  images: { url: string; isPrimary: boolean }[];
  productName: string;
  isSold?: boolean;
}

export default function ProductImageGallery({
  images,
  productName,
  isSold = false,
}: ProductImageGalleryProps) {
  const defaultImage = images[0]?.url || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=800';
  const [selectedImage, setSelectedImage] = useState(defaultImage);

  return (
    <div className="flex flex-col gap-4">
      {/* Main Large Image */}
      <div className="w-full aspect-[3/4] bg-surface-container-low rounded-2xl overflow-hidden border border-outline-variant/25 relative shadow-md">
        <Image
          src={selectedImage}
          alt={productName}
          fill
          priority
          sizes="(max-width: 768px) 100vw, 50vw"
          className="object-cover transition-opacity duration-300"
        />
        {isSold && (
          <div className="absolute inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-10">
            <span className="bg-surface/90 text-on-surface font-display text-lg px-6 py-2 rounded-full uppercase tracking-wider shadow-md">
              Found its home
            </span>
          </div>
        )}
      </div>

      {/* Thumbnail Selector (if multiple images exist) */}
      {images.length > 1 && (
        <div className="flex gap-2.5 overflow-x-auto pb-2 pt-1 scrollbar-none">
          {images.map((img, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setSelectedImage(img.url)}
              className={`w-16 h-20 shrink-0 rounded-lg overflow-hidden border-2 transition-all cursor-pointer relative ${
                selectedImage === img.url
                  ? 'border-primary shadow-sm scale-105'
                  : 'border-outline-variant/30 opacity-70 hover:opacity-100'
              }`}
            >
              <Image
                src={img.url}
                alt={`${productName} thumbnail ${idx + 1}`}
                fill
                sizes="64px"
                className="object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
