'use client';

import React, { useState, useEffect } from 'react';
import PriceTag, { PriceTagProduct } from './PriceTag';
import { printPriceTags } from '@/lib/printPriceTags';

interface BulkPriceTagModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: PriceTagProduct[];
}

export default function BulkPriceTagModal({
  isOpen,
  onClose,
  products,
}: BulkPriceTagModalProps) {
  // Print layout: 'thermal' (2.5in x 1.5in continuous roll) | 'sheet' (A4 multi-tag grid)
  const [printLayout, setPrintLayout] = useState<'thermal' | 'sheet'>('thermal');
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  useEffect(() => {
    if (isOpen) {
      const initialQtys: Record<string, number> = {};
      products.forEach(p => {
        initialQtys[p.id] = 1;
      });
      setQuantities(initialQtys);

      const origOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = origOverflow;
      };
    }
  }, [isOpen, products]);

  if (!isOpen || products.length === 0) return null;

  const totalTagCount = Object.values(quantities).reduce((a, b) => a + b, 0);

  const handleQtyChange = (id: string, delta: number) => {
    setQuantities(prev => {
      const curr = prev[id] || 1;
      const next = Math.max(1, Math.min(50, curr + delta));
      return { ...prev, [id]: next };
    });
  };

  const handlePrint = () => {
    const items = products.map(p => ({
      product: p,
      quantity: quantities[p.id] || 1,
    }));
    printPriceTags(items, printLayout);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-3 sm:p-4 animate-fade-in">
      <div className="w-full max-w-4xl bg-white border border-[#E4C8CF] rounded-2xl shadow-2xl flex flex-col max-h-[92dvh] overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-outline-variant/20 flex justify-between items-center bg-surface-container-lowest/80 shrink-0">
          <div>
            <h2 className="font-display font-semibold text-xl sm:text-2xl text-primary uppercase tracking-wider flex items-center gap-2">
              <span className="material-symbols-outlined">label</span>
              Price Tags Printing
            </h2>
            <p className="text-xs text-outline font-label-md uppercase tracking-wider mt-0.5">
              {products.length} {products.length === 1 ? 'Product' : 'Products'} Selected • {totalTagCount} Total Tags (2.5″ × 1.5″)
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-outline hover:text-on-surface hover:bg-surface-container-low rounded-full transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Controls Bar */}
        <div className="px-6 py-3 bg-surface-container-low/50 border-b border-outline-variant/15 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-label-md uppercase tracking-wider text-on-surface-variant font-semibold">
              Printer Format:
            </span>
            <div className="inline-flex rounded-lg border border-outline-variant/30 p-0.5 bg-white">
              <button
                type="button"
                onClick={() => setPrintLayout('thermal')}
                className={`px-3 py-1 text-xs font-label-md uppercase tracking-wider rounded-md transition-colors cursor-pointer ${
                  printLayout === 'thermal'
                    ? 'bg-primary text-white font-bold'
                    : 'text-on-surface-variant hover:bg-surface-container-low'
                }`}
              >
                Thermal Label (1.5″ × 2.5″)
              </button>
              <button
                type="button"
                onClick={() => setPrintLayout('sheet')}
                className={`px-3 py-1 text-xs font-label-md uppercase tracking-wider rounded-md transition-colors cursor-pointer ${
                  printLayout === 'sheet'
                    ? 'bg-primary text-white font-bold'
                    : 'text-on-surface-variant hover:bg-surface-container-low'
                }`}
              >
                Standard A4 / Letter Sheet
              </button>
            </div>
          </div>

          <span className="text-xs text-on-surface-variant/80 italic">
            {printLayout === 'thermal' 
              ? 'Standard 2.5″ × 1.5″ individual label roll' 
              : 'Multi-tag grid with dashed borders for cut-out'}
          </span>
        </div>

        {/* Scrollable Preview Grid */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 overscroll-contain bg-surface/30">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {products.map(product => {
              const qty = quantities[product.id] || 1;
              return (
                <div 
                  key={product.id} 
                  className="bg-white p-3 rounded-xl border border-outline-variant/30 shadow-xs flex flex-col items-center gap-2"
                >
                  {/* Tag Preview */}
                  <div className="scale-90 sm:scale-100 origin-center">
                    <PriceTag product={product} />
                  </div>

                  {/* Quantity Selector */}
                  <div className="w-full flex items-center justify-between pt-2 border-t border-outline-variant/15 text-xs font-label-md">
                    <span className="text-outline uppercase text-[10px] truncate max-w-[120px]">
                      {product.productCode}
                    </span>
                    <div className="flex items-center gap-1.5 bg-surface-container-low px-2 py-0.5 rounded-full">
                      <button
                        type="button"
                        onClick={() => handleQtyChange(product.id, -1)}
                        className="w-5 h-5 flex items-center justify-center text-primary font-bold hover:bg-primary/10 rounded-full cursor-pointer"
                      >
                        -
                      </button>
                      <span className="font-bold text-on-surface w-4 text-center">{qty}</span>
                      <button
                        type="button"
                        onClick={() => handleQtyChange(product.id, 1)}
                        className="w-5 h-5 flex items-center justify-center text-primary font-bold hover:bg-primary/10 rounded-full cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Sticky Modal Footer */}
        <div className="px-6 py-4 bg-white border-t border-outline-variant/20 flex items-center justify-between gap-4 shrink-0 shadow-[0_-4px_16px_rgba(0,0,0,0.03)]">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 border border-outline/40 hover:bg-surface-container-low text-on-surface-variant rounded-full text-xs font-label-md uppercase tracking-wider cursor-pointer font-semibold transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="px-6 py-2.5 bg-primary hover:opacity-95 text-white rounded-full text-xs font-label-md uppercase tracking-wider cursor-pointer font-bold shadow-sm transition-all active:scale-[0.99] flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]">print</span>
            <span>Print {totalTagCount} {totalTagCount === 1 ? 'Price Tag' : 'Price Tags'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
