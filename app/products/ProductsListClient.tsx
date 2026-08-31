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
  collection?: { id: string; name: string } | null;
  attributes?: { id: string; value: string; definition?: { key: string; name: string } }[];
  images: { url: string }[];
}

interface ProductsListClientProps {
  products: ProductItem[];
}

export default function ProductsListClient({ products }: ProductsListClientProps) {
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
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
    <div className="flex flex-col gap-4">
      {/* Top Toolbar: Selection & View Mode */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-surface-container-lowest border border-outline-variant/25 rounded-xl shadow-xs">
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
              className="px-3.5 py-1.5 bg-primary text-white rounded-lg text-xs font-label-md uppercase tracking-wider font-bold shadow-xs hover:opacity-90 transition-all flex items-center gap-1.5 cursor-pointer animate-fade-in"
            >
              <span className="material-symbols-outlined text-[15px]">print</span>
              <span>Print Tags ({selectedIds.size})</span>
            </button>
          )}

          {/* View Mode Toggle */}
          <div className="flex items-center bg-surface-container-low p-0.5 rounded-lg border border-outline-variant/20">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`px-2.5 py-1 rounded-md text-xs flex items-center gap-1 transition-all cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-surface text-primary shadow-xs font-bold'
                  : 'text-outline hover:text-on-surface'
              }`}
              title="Crisp List View"
            >
              <span className="material-symbols-outlined text-[16px]">view_list</span>
              <span className="hidden sm:inline text-[11px] uppercase tracking-wider">List</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`px-2.5 py-1 rounded-md text-xs flex items-center gap-1 transition-all cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-surface text-primary shadow-xs font-bold'
                  : 'text-outline hover:text-on-surface'
              }`}
              title="Grid View"
            >
              <span className="material-symbols-outlined text-[16px]">grid_view</span>
              <span className="hidden sm:inline text-[11px] uppercase tracking-wider">Grid</span>
            </button>
          </div>
        </div>
      </div>

      {/* CRISP LIST VIEW */}
      {viewMode === 'list' ? (
        <div className="bg-surface-container-lowest border border-outline-variant/25 rounded-xl overflow-hidden shadow-xs">
          {/* Table Header */}
          <div className="hidden md:grid grid-cols-12 gap-3 px-4 py-3 bg-surface-container-low/50 border-b border-outline-variant/20 text-[10px] font-label-md uppercase tracking-widest text-outline">
            <div className="col-span-1 flex items-center">Select</div>
            <div className="col-span-4">Product & Craftsmanship</div>
            <div className="col-span-2">Category / Spec</div>
            <div className="col-span-1 text-center">Stock</div>
            <div className="col-span-2 text-right">Price</div>
            <div className="col-span-2 text-right">Actions</div>
          </div>

          {/* Table Rows */}
          <div className="divide-y divide-outline-variant/15">
            {products.map((product) => {
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

              // Extract fabric if present
              const fabricAttr = product.attributes?.find(
                (a) => a.definition?.key === 'fabric' || a.definition?.name.toLowerCase() === 'fabric'
              )?.value;

              return (
                <div
                  key={product.id}
                  className={`p-3 md:px-4 md:py-2.5 transition-all flex flex-col md:grid md:grid-cols-12 md:items-center gap-3 hover:bg-surface-container-low/40 ${
                    isSelected ? 'bg-primary/5' : ''
                  }`}
                >
                  {/* Selection Checkbox & Mobile Preview */}
                  <div className="col-span-1 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => toggleSelect(product.id, e)}
                      className="w-6 h-6 rounded border border-outline-variant/40 flex items-center justify-center text-primary hover:border-primary transition-colors cursor-pointer bg-white"
                      aria-label={`Select ${product.name}`}
                    >
                      <span className="material-symbols-outlined text-[16px]">
                        {isSelected ? 'check_box' : 'check_box_outline_blank'}
                      </span>
                    </button>
                  </div>

                  {/* Photo & Name */}
                  <div className="col-span-4 flex items-center gap-3 min-w-0">
                    <Link
                      href={`/products/${product.id}`}
                      className="relative w-12 h-14 md:w-14 md:h-16 rounded-lg overflow-hidden shrink-0 border border-outline-variant/30 group bg-surface-container-low shadow-2xs"
                    >
                      <Image
                        src={mainImg}
                        alt={product.name}
                        fill
                        sizes="64px"
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </Link>
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono text-[9px] font-bold text-outline uppercase px-1.5 py-0.2 rounded bg-surface-container-high border border-outline-variant/30">
                          {product.productCode}
                        </span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full uppercase tracking-wider border ${statusClass}`}>
                          {statusLabel}
                        </span>
                      </div>
                      <Link
                        href={`/products/${product.id}`}
                        className="font-headline-sm text-xs md:text-sm text-on-surface font-semibold hover:text-primary transition-colors truncate mt-0.5"
                      >
                        {product.name}
                      </Link>
                      {product.collection && (
                        <span className="text-[10px] text-secondary font-label-sm truncate">
                          {product.collection.name}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Category & Spec */}
                  <div className="col-span-2 flex flex-col gap-0.5">
                    <span className="text-xs font-semibold text-on-surface capitalize">
                      {product.category?.name}
                    </span>
                    <div className="flex items-center gap-1 flex-wrap text-[10px] text-on-surface-variant">
                      {product.primaryColour && (
                        <span className="bg-surface-container-low px-1.5 py-0.5 rounded border border-outline-variant/20 truncate max-w-[100px]">
                          {product.primaryColour}
                        </span>
                      )}
                      {fabricAttr && (
                        <span className="bg-surface-container-low px-1.5 py-0.5 rounded border border-outline-variant/20 truncate max-w-[110px]">
                          {fabricAttr}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Stock Level */}
                  <div className="col-span-1 text-left md:text-center">
                    {product.isUnique ? (
                      <span className="inline-block bg-primary/10 text-primary text-[9px] font-bold px-2 py-0.5 rounded border border-primary/20">
                        1 Unique
                      </span>
                    ) : (
                      <span className="text-xs font-medium text-on-surface">
                        {product.quantity} in stock
                      </span>
                    )}
                  </div>

                  {/* Retail Price */}
                  <div className="col-span-2 text-left md:text-right">
                    <span className="font-headline-sm text-sm md:text-base font-bold text-primary">
                      ₹{Number(product.price).toLocaleString('en-IN')}
                    </span>
                  </div>

                  {/* Quick Actions */}
                  <div className="col-span-2 flex items-center justify-start md:justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setSinglePrintProduct(product);
                        setIsBulkModalOpen(true);
                      }}
                      className="px-2.5 py-1.5 bg-surface-container-low hover:bg-primary hover:text-white text-on-surface-variant text-[10px] font-label-md uppercase tracking-wider rounded-lg transition-all flex items-center gap-1 cursor-pointer border border-outline-variant/25"
                      title="Print 1.5in x 2.5in Price Tag"
                    >
                      <span className="material-symbols-outlined text-[13px]">label</span>
                      <span className="hidden xl:inline">Print Tag</span>
                    </button>

                    <Link
                      href={`/products/${product.id}`}
                      className="px-2.5 py-1.5 bg-surface-container-low hover:bg-surface-container-high text-on-surface text-[10px] font-label-md uppercase tracking-wider rounded-lg transition-colors flex items-center gap-1 border border-outline-variant/25"
                      title="View Details"
                    >
                      <span className="material-symbols-outlined text-[13px]">visibility</span>
                      <span className="hidden xl:inline">View</span>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* GRID VIEW */
        <section className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {products.map((product) => {
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
                    : 'border-outline-variant/20 hover:shadow-md'
                }`}
              >
                {/* Checkbox Selector Badge */}
                <button
                  type="button"
                  onClick={(e) => toggleSelect(product.id, e)}
                  className="absolute top-2.5 left-2.5 z-20 w-6 h-6 bg-white/95 backdrop-blur-xs rounded-md shadow-xs flex items-center justify-center text-primary transition-transform hover:scale-105 cursor-pointer border border-outline-variant/30"
                  aria-label={`Select ${product.name}`}
                >
                  <span className="material-symbols-outlined text-[16px]">
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
                      sizes="(max-width: 768px) 50vw, 20vw"
                      className="object-cover group-hover:scale-102 transition-transform duration-500"
                    />
                    <span className={`absolute top-2.5 right-2.5 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider border ${statusClass}`}>
                      {statusLabel}
                    </span>
                  </div>

                  {/* Info details */}
                  <div className="p-3 flex flex-col gap-1 flex-grow justify-between">
                    <div>
                      <div className="flex justify-between items-center text-[9px] text-outline">
                        <span className="font-mono font-bold uppercase">{product.productCode}</span>
                        <span className="capitalize">{product.category?.name}</span>
                      </div>
                      <h3 className="font-headline-sm text-xs md:text-sm text-on-surface font-semibold truncate group-hover:text-primary transition-colors mt-0.5">
                        {product.name}
                      </h3>
                    </div>

                    <div className="flex justify-between items-center mt-2 pt-2 border-t border-outline-variant/10">
                      <span className="font-headline-md text-xs md:text-sm text-primary font-bold">
                        ₹{Number(product.price).toLocaleString('en-IN')}
                      </span>
                      <span className="text-[9px] font-medium text-on-surface-variant">
                        {product.isUnique ? '1 Unique' : `${product.quantity} left`}
                      </span>
                    </div>
                  </div>
                </Link>

                {/* Card Footer Quick Print Button */}
                <div className="px-3 pb-2.5 pt-0 flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setSinglePrintProduct(product);
                      setIsBulkModalOpen(true);
                    }}
                    className="w-full py-1.5 bg-surface-container-low hover:bg-primary hover:text-white text-on-surface-variant text-[9px] font-label-md uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer border border-outline-variant/20"
                  >
                    <span className="material-symbols-outlined text-[12px]">label</span>
                    <span>Print Tag</span>
                  </button>
                </div>
              </div>
            );
          })}
        </section>
      )}

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
    </div>
  );
}
