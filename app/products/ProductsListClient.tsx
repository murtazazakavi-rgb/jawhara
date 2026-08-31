'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import BulkPriceTagModal from '@/components/BulkPriceTagModal';
import { PriceTagProduct } from '@/components/PriceTag';

interface ProductItem {
  id: string;
  productCode: string;
  name: string;
  slug: string;
  price: any;
  quantity: number;
  isUnique: boolean;
  inventoryStatus: string;
  primaryColour?: string | null;
  category: { id: string; name: string };
  images: { url: string }[];
}

interface ProductsListClientProps {
  products: ProductItem[];
}

export default function ProductsListClient({ products }: ProductsListClientProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [singlePrintProduct, setSinglePrintProduct] = useState<PriceTagProduct | null>(null);

  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === products.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(products.map(p => p.id)));
    }
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const selectedProducts: PriceTagProduct[] = singlePrintProduct
    ? [singlePrintProduct]
    : products.filter(p => selectedIds.has(p.id));

  return (
    <>
      {/* Top Bulk Selection Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6 p-4 bg-surface-container-lowest border border-outline-variant/25 rounded-xl">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={selectAll}
            className="flex items-center gap-2 text-xs font-label-md uppercase tracking-wider text-on-surface-variant hover:text-primary transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">
              {selectedIds.size === products.length && products.length > 0
                ? 'check_box'
                : selectedIds.size > 0
                ? 'indeterminate_check_box'
                : 'check_box_outline_blank'}
            </span>
            <span>
              {selectedIds.size === products.length && products.length > 0
                ? 'Deselect All'
                : `Select All (${products.length})`}
            </span>
          </button>

          {selectedIds.size > 0 && (
            <span className="text-xs font-semibold text-primary bg-primary/10 px-2.5 py-0.5 rounded-full">
              {selectedIds.size} selected
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {selectedIds.size > 0 && (
            <button
              type="button"
              onClick={() => {
                setSinglePrintProduct(null);
                setIsBulkModalOpen(true);
              }}
              className="px-4 py-2 bg-primary text-white rounded-lg text-xs font-label-md uppercase tracking-wider font-bold shadow-sm hover:opacity-90 transition-all flex items-center gap-1.5 cursor-pointer animate-fade-in"
            >
              <span className="material-symbols-outlined text-[16px]">print</span>
              <span>Print Price Tags ({selectedIds.size})</span>
            </button>
          )}
        </div>
      </div>

      {/* Product Grid */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-gutter">
        {products.map(product => {
          const mainImg = product.images[0]?.url || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=300';
          const isSelected = selectedIds.has(product.id);

          let statusLabel = 'Available';
          let statusClass = 'bg-success/10 text-success border-success/20';

          const isSoldOut =
            product.inventoryStatus === 'SOLD' ||
            product.inventoryStatus === 'DELIVERED' ||
            product.inventoryStatus === 'DISPATCHED' ||
            product.quantity <= 0;

          if (product.inventoryStatus === 'RESERVED') {
            statusLabel = 'On Hold';
            statusClass = 'bg-warning/10 text-warning border-warning/20';
          } else if (isSoldOut) {
            statusLabel = 'Sold Out';
            statusClass = 'bg-error/10 text-error border-error/20';
          }

          return (
            <div
              key={product.id}
              className={`bg-surface-container-lowest rounded-xl overflow-hidden border transition-all flex flex-col group relative ${
                isSelected
                  ? 'border-primary ring-2 ring-primary/30 shadow-md'
                  : 'border-outline-variant/20 hover:shadow-[0_4px_20px_rgba(117,85,102,0.04)]'
              }`}
            >
              {/* Checkbox Selector Badge */}
              <button
                type="button"
                onClick={(e) => toggleSelect(product.id, e)}
                className="absolute top-3 left-3 z-20 w-7 h-7 bg-white/90 backdrop-blur-xs rounded-lg shadow-sm flex items-center justify-center text-primary transition-transform hover:scale-105 cursor-pointer border border-outline-variant/30"
                aria-label={`Select ${product.name}`}
              >
                <span className="material-symbols-outlined text-[18px]">
                  {isSelected ? 'check_box' : 'check_box_outline_blank'}
                </span>
              </button>

              <Link href={`/products/${product.id}`} className="block flex-grow">
                {/* Photo container */}
                <div className="aspect-[3/4] w-full bg-surface-container-low relative overflow-hidden">
                  <Image
                    src={mainImg}
                    alt={product.name}
                    fill
                    sizes="(max-width: 768px) 50vw, 25vw"
                    className="object-cover group-hover:scale-102 transition-transform duration-500"
                  />

                  {/* Status Badge */}
                  <span className={`absolute top-3 right-3 text-[10px] font-semibold px-2.5 py-0.5 rounded-full uppercase tracking-wider border ${statusClass}`}>
                    {statusLabel}
                  </span>
                </div>

                {/* Info details */}
                <div className="p-4 flex flex-col gap-1.5 flex-grow justify-between">
                  <div>
                    <div className="flex justify-between items-center">
                      <span className="font-label-sm text-[10px] text-outline uppercase tracking-wider">
                        {product.productCode}
                      </span>
                      <span className="text-[9px] font-label-sm text-outline capitalize">
                        {product.category?.name}
                      </span>
                    </div>
                    <h3 className="font-headline-sm text-sm md:text-base text-on-surface truncate group-hover:text-primary transition-colors mt-0.5">
                      {product.name}
                    </h3>
                  </div>

                  <div className="flex justify-between items-center mt-2 pt-2 border-t border-outline-variant/10">
                    <span className="font-headline-md text-sm md:text-base text-primary font-bold">
                      ₹{Number(product.price).toLocaleString('en-IN')}
                    </span>
                    <span className="text-[10px] font-medium text-on-surface-variant flex items-center gap-1">
                      {product.isUnique ? (
                        <span className="bg-primary/5 text-primary text-[9px] font-bold px-1.5 py-0.5 rounded border border-primary/10">
                          Unique
                        </span>
                      ) : (
                        `Stock: ${product.quantity}`
                      )}
                    </span>
                  </div>
                </div>
              </Link>

              {/* Card Footer Quick Print Button */}
              <div className="px-4 pb-3 pt-0 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSinglePrintProduct(product);
                    setIsBulkModalOpen(true);
                  }}
                  className="w-full py-1.5 bg-surface-container-low hover:bg-primary hover:text-white text-on-surface-variant text-[10px] font-label-md uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer border border-outline-variant/20"
                >
                  <span className="material-symbols-outlined text-[13px]">label</span>
                  <span>Print Tag (1.5″ × 2.5″)</span>
                </button>
              </div>
            </div>
          );
        })}
      </section>

      {/* Floating Bottom Bar when items are selected */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-surface-container-lowest/95 backdrop-blur-md border border-primary/30 shadow-2xl rounded-full px-6 py-3 z-50 flex items-center gap-4 animate-fade-in">
          <span className="text-xs font-semibold text-on-surface font-label-md">
            <strong>{selectedIds.size}</strong> products selected
          </span>
          <div className="h-4 w-px bg-outline-variant/30"></div>
          <button
            type="button"
            onClick={() => {
              setSinglePrintProduct(null);
              setIsBulkModalOpen(true);
            }}
            className="px-4 py-2 bg-primary text-white text-xs font-label-md uppercase tracking-wider font-bold rounded-full hover:opacity-90 transition-opacity flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <span className="material-symbols-outlined text-[16px]">print</span>
            <span>Print Price Tags</span>
          </button>
          <button
            type="button"
            onClick={clearSelection}
            className="text-[11px] text-outline hover:text-on-surface font-label-md uppercase tracking-wider cursor-pointer"
          >
            Clear
          </button>
        </div>
      )}

      {/* Bulk / Single Price Tag Print Modal */}
      <BulkPriceTagModal
        isOpen={isBulkModalOpen}
        onClose={() => {
          setIsBulkModalOpen(false);
          setSinglePrintProduct(null);
        }}
        products={selectedProducts}
      />
    </>
  );
}
