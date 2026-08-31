'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { 
  createReservation, 
  releaseReservation, 
  markProductSold,
  toggleProductPublishStatusAction,
  deleteProductAction
} from './actions';
import PriceTag from '@/components/PriceTag';

interface ProductDetailsClientProps {
  product: any;
  customers: any[];
  activeReservation: any | null;
  salesHistory: any[];
}

export default function ProductDetailsClient({
  product,
  customers,
  activeReservation,
  salesHistory,
}: ProductDetailsClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [deleting, setDeleting] = useState(false);

  const handleTogglePublish = async () => {
    const nextStatus = product.publishStatus === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED';
    try {
      const res = await toggleProductPublishStatusAction(product.id, nextStatus);
      if (res.error) {
        alert(res.error);
      } else {
        router.refresh();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteProduct = async () => {
    if (!confirm('Are you sure you want to delete this product? It will be archived (unpublished) if it has order history, or deleted permanently if not.')) {
      return;
    }
    
    setDeleting(true);
    try {
      const res = await deleteProductAction(product.id);
      if (res.error) {
        alert(res.error);
      } else {
        alert(res.archived ? 'Product has order history and has been archived (unpublished) successfully.' : 'Product deleted permanently.');
        router.push('/products');
        router.refresh();
      }
    } catch (err) {
      console.error(err);
      alert('Failed to delete product.');
    } finally {
      setDeleting(false);
    }
  };

  // Modals state
  const [isReserveOpen, setIsReserveOpen] = useState(false);
  const [isSaleOpen, setIsSaleOpen] = useState(false);

  // Gallery state
  const allImages = product.images.length > 0 
    ? product.images.map((img: any) => img.url) 
    : ['https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=600'];
  const [selectedImage, setSelectedImage] = useState(allImages[0]);

  // Reservation form state
  const [resCustomerId, setResCustomerId] = useState('');
  const [resExpiry, setResExpiry] = useState('');
  const [resNotes, setResNotes] = useState('');
  const [resError, setResError] = useState('');

  // Sale form state
  const [saleCustomerId, setSaleCustomerId] = useState(activeReservation?.customerId || '');
  const [salePrice, setSalePrice] = useState(product.price.toString());
  const [salePaymentStatus, setSalePaymentStatus] = useState<'PAID' | 'UNPAID'>('PAID');
  const [saleNotes, setSaleNotes] = useState('');
  const [saleError, setSaleError] = useState('');

  // WhatsApp Message Generator
  const handleWhatsAppShare = () => {
    const text = `${product.name}\n${product.shortDesc || ''}\nPrice: ₹${Number(product.price).toLocaleString('en-IN')}\nStatus: ${product.inventoryStatus}\nView: ${window.location.origin}/p/${product.slug}`;
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  // Handle reserve action
  const handleReserveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resCustomerId) {
      setResError('Please select a customer.');
      return;
    }
    setResError('');

    startTransition(async () => {
      const res = await createReservation({
        productId: product.id,
        customerId: resCustomerId,
        notes: resNotes,
        expiresAtStr: resExpiry,
      });

      if (res.error) {
        setResError(res.error);
      } else {
        setIsReserveOpen(false);
        setResCustomerId('');
        setResExpiry('');
        setResNotes('');
        router.refresh();
      }
    });
  };

  // Handle release action
  const handleRelease = () => {
    if (!confirm('Are you sure you want to release this reservation?')) return;

    startTransition(async () => {
      const res = await releaseReservation({ productId: product.id });
      if (res.error) {
        alert(res.error);
      } else {
        router.refresh();
      }
    });
  };

  // Handle mark sold action
  const handleSaleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!saleCustomerId) {
      setSaleError('Please select a customer.');
      return;
    }
    const parsedPrice = parseFloat(salePrice);
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      setSaleError('Please enter a valid price.');
      return;
    }
    setSaleError('');

    startTransition(async () => {
      const res = await markProductSold({
        productId: product.id,
        customerId: saleCustomerId,
        price: parsedPrice,
        paymentStatus: salePaymentStatus,
        notes: saleNotes,
      });

      if (res.error) {
        setSaleError(res.error);
      } else {
        setIsSaleOpen(false);
        setSaleCustomerId('');
        setSalePrice(product.price.toString());
        setSalePaymentStatus('PAID');
        setSaleNotes('');
        router.refresh();
      }
    });
  };

  // Helpers
  const isAvailable = product.inventoryStatus === 'AVAILABLE';
  const isReserved = product.inventoryStatus === 'RESERVED';
  const isSold = product.inventoryStatus === 'SOLD';

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-gutter relative">
      {/* Left Column: Image Section */}
      <section className="md:col-span-5 flex flex-col gap-4">
        <div className="w-full aspect-[3/4] bg-surface-container-low rounded-xl overflow-hidden border border-outline-variant/30 relative group">
          <img
            src={selectedImage}
            alt={product.name}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
          <div className="absolute top-4 right-4 flex flex-col gap-2">
            <span className={`bg-surface/90 backdrop-blur-sm font-label-sm text-xs px-3 py-1 rounded-full uppercase tracking-widest border border-outline-variant/20 shadow-sm ${
              isAvailable ? 'text-primary' : 'text-on-surface-variant'
            }`}>
              {product.inventoryStatus}
            </span>
          </div>
        </div>

        {/* Gallery Thumbnails */}
        {allImages.length > 1 && (
          <div className="grid grid-cols-4 gap-2 mt-2">
            {allImages.map((img: string, idx: number) => (
              <button
                key={idx}
                onClick={() => setSelectedImage(img)}
                className={`aspect-square bg-surface-container-low rounded-lg overflow-hidden border transition-all ${
                  selectedImage === img ? 'border-primary scale-[0.98]' : 'border-transparent opacity-60 hover:opacity-100'
                }`}
              >
                <img src={img} alt={`Thumbnail ${idx + 1}`} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Right Column: Details Section */}
      <section className="md:col-span-7 flex flex-col pt-4 md:pt-0 md:pl-8">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4 pb-4 border-b border-outline-variant/20">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-label-md text-outline uppercase tracking-wider">Catalog Visibility:</span>
            <span className={`text-[10px] font-label-sm px-2.5 py-0.5 rounded-full uppercase tracking-wider border font-bold ${
              product.publishStatus === 'PUBLISHED'
                ? 'bg-success/15 text-success border-success/30'
                : product.publishStatus === 'DRAFT'
                ? 'bg-primary/15 text-primary border-primary/30'
                : 'bg-outline-variant/15 text-on-surface-variant border-outline-variant/30'
            }`}>
              {product.publishStatus}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleTogglePublish}
              className="text-[11px] px-3 py-1.5 border border-outline-variant hover:bg-surface-container-low transition-colors rounded font-label-md uppercase tracking-wider cursor-pointer"
            >
              {product.publishStatus === 'PUBLISHED' ? 'Set to Draft' : 'Publish'}
            </button>
            <button
              onClick={handleDeleteProduct}
              disabled={deleting}
              className="text-[11px] px-3 py-1.5 border border-error text-error hover:bg-error/5 transition-colors rounded font-label-md uppercase tracking-wider cursor-pointer disabled:opacity-50"
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </div>

        <div className="mb-8">
          <p className="font-label-sm text-secondary uppercase tracking-widest mb-2">
            {product.collection?.name || 'Standard Collection'}
          </p>
          <h2 className="font-display-lg text-on-surface mb-4">{product.name}</h2>
          <div className="flex items-baseline gap-4 mb-6">
            <span className="font-headline-lg text-primary text-3xl">
              ₹{product.price.toLocaleString('en-IN')}
            </span>
            <span className="font-body-md text-on-surface-variant">Retail Price</span>
          </div>
          <p className="font-body-lg text-on-surface-variant leading-relaxed">
            {product.description || 'No description provided.'}
          </p>
        </div>

        {/* Specs Grid (Dynamically rendering attributes) */}
        <div className="grid grid-cols-2 gap-x-8 gap-y-6 py-8 border-y border-outline-variant/30 mb-10">
          <div className="flex flex-col gap-1">
            <span className="font-label-md text-secondary uppercase">Product Code</span>
            <span className="font-body-md text-on-surface">{product.productCode}</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="font-label-md text-secondary uppercase">Stock Level</span>
            <div className="flex items-center gap-2">
              <span className="font-body-md text-on-surface">
                {product.quantity} {product.isUnique ? 'Unique Unit' : 'Units'}
              </span>
              <div className={`w-2.5 h-2.5 rounded-full ${product.quantity > 0 ? 'bg-primary-container' : 'bg-error'}`} />
            </div>
          </div>

          {/* Dynamic Category Attributes */}
          {Array.from(new Map(product.attributes.map((a: any) => [a.definition?.key || a.definition?.name || a.id, a])).values()).map((attr: any) => (
            <div key={attr.id} className="flex flex-col gap-1">
              <span className="font-label-md text-secondary uppercase">{attr.definition.name}</span>
              <span className="font-body-md text-on-surface">{attr.value}</span>
            </div>
          ))}
        </div>

        {/* Active Reservation Info block if reserved */}
        {isReserved && activeReservation && (
          <div className="bg-[#E4C8CF]/30 rounded-xl p-6 border border-[#E4C8CF] mb-10">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>
                  bookmark
                </span>
                <h3 className="font-headline-sm text-on-primary-container text-base">Reserved for Client</h3>
              </div>
              <button
                onClick={handleRelease}
                disabled={isPending}
                className="font-label-sm text-xs text-error hover:underline disabled:opacity-50"
              >
                Release Reservation
              </button>
            </div>
            <p className="font-body-md text-on-surface-variant">
              Reserved for <span className="font-semibold">{activeReservation.customer.name}</span> ({activeReservation.customer.mobile}) by {activeReservation.reservedBy}.
              {activeReservation.expiresAt && ` Expires on ${new Date(activeReservation.expiresAt).toLocaleDateString()}`}
            </p>
            {activeReservation.notes && (
              <p className="font-body-sm text-xs text-on-surface-variant/80 italic mt-2">
                Note: "{activeReservation.notes}"
              </p>
            )}
          </div>
        )}

        {/* AI Insight Box */}
        <div className="bg-[#E4C8CF]/20 rounded-xl p-6 border border-[#E4C8CF]/50 mb-10">
          <div className="flex items-center gap-3 mb-3">
            <span className="material-symbols-outlined text-primary-container" style={{ fontVariationSettings: "'FILL' 1" }}>
              auto_awesome
            </span>
            <h3 className="font-headline-sm text-on-primary-container text-base">AI Product Insight</h3>
          </div>
          <p className="font-body-md text-on-surface-variant">
            {product.isUnique 
              ? 'One-of-one item. Premium pricing recommended. High probability of sales alignment with VIP pastel collections.'
              : 'Multi-item batch product. Optimal stock status detected.'}
          </p>
        </div>

        {/* Actions Button Bar */}
        <div className="flex flex-col sm:flex-row gap-4 mb-16">
          <button
            onClick={handleWhatsAppShare}
            className="flex-1 border border-primary-container text-primary-container py-4 px-6 rounded font-label-md uppercase tracking-wider hover:bg-primary-container/5 transition-colors flex justify-center items-center gap-2"
          >
            <span className="material-symbols-outlined">share</span>
            Share on WhatsApp
          </button>

          <button
            onClick={() => window.print()}
            className="flex-1 border border-primary text-primary py-4 px-6 rounded font-label-md uppercase tracking-wider hover:bg-primary/5 transition-colors flex justify-center items-center gap-2 cursor-pointer"
          >
            <span className="material-symbols-outlined">print</span>
            Print Price Tag
          </button>

          {isAvailable && (
            <button
              onClick={() => setIsReserveOpen(true)}
              className="flex-1 border border-primary text-primary py-4 px-6 rounded font-label-md uppercase tracking-wider hover:bg-primary/5 transition-colors flex justify-center items-center gap-2"
            >
              <span className="material-symbols-outlined">bookmark</span>
              Reserve
            </button>
          )}

          {!isSold && (
            <button
              onClick={() => setIsSaleOpen(true)}
              className="flex-1 bg-primary text-on-primary py-4 px-6 rounded font-label-md uppercase tracking-wider hover:opacity-90 transition-opacity flex justify-center items-center gap-2"
            >
              <span className="material-symbols-outlined">add_shopping_cart</span>
              Mark Sold
            </button>
          )}

          {isSold && (
            <button
              disabled
              className="flex-grow bg-surface-container-high text-on-surface-variant opacity-70 py-4 px-6 rounded font-label-md uppercase tracking-wider flex justify-center items-center gap-2"
            >
              <span className="material-symbols-outlined">check_circle</span>
              Sold Piece
            </button>
          )}
        </div>

        {/* Sales History List */}
        <div>
          <h3 className="font-headline-md text-on-surface mb-6 border-b border-outline-variant/20 pb-2">
            Boutique Sales History
          </h3>
          {salesHistory.length === 0 ? (
            <p className="font-body-md text-on-surface-variant italic">No order entries registered for this product.</p>
          ) : (
            <div className="flex flex-col gap-4">
              {salesHistory.map((item) => (
                <div
                  key={item.id}
                  className="bg-surface rounded-lg p-4 border border-outline-variant/20 flex items-center justify-between hover:shadow-sm transition-shadow"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center text-secondary">
                      <span className="material-symbols-outlined text-sm">shopping_bag</span>
                    </div>
                    <div>
                      <p className="font-label-md text-on-surface">Order {item.order.orderNumber}</p>
                      <p className="font-body-sm text-[13px] text-on-surface-variant">
                        {new Date(item.order.createdAt).toLocaleDateString()} · Buyer: {item.order.customer.name}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-label-md text-on-surface">Qty: {item.quantity}</p>
                    <p className="font-body-sm text-primary font-semibold">₹{item.finalPrice.toLocaleString('en-IN')}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Reservation Dialog Modal */}
      {isReserveOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-8 max-w-md w-full shadow-2xl relative">
            <h3 className="font-display font-semibold text-headline-sm text-on-surface mb-6">
              Reserve "{product.name}"
            </h3>

            <form onSubmit={handleReserveSubmit} className="flex flex-col gap-5">
              {/* Customer Select */}
              <div className="flex flex-col gap-1.5">
                <label className="font-label-md text-xs text-on-surface-variant uppercase">Select Customer</label>
                <select
                  required
                  value={resCustomerId}
                  onChange={(e) => setResCustomerId(e.target.value)}
                  className="w-full bg-transparent border-0 border-b border-outline-variant focus:border-primary focus:ring-0 py-2 font-body-md"
                >
                  <option value="">-- Choose Client --</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.mobile})
                    </option>
                  ))}
                </select>
              </div>

              {/* Expiry Date */}
              <div className="flex flex-col gap-1.5 mt-2">
                <label className="font-label-md text-xs text-on-surface-variant uppercase">Expiry Date (Optional)</label>
                <input
                  type="date"
                  value={resExpiry}
                  onChange={(e) => setResExpiry(e.target.value)}
                  className="w-full bg-transparent border-0 border-b border-outline-variant focus:border-primary focus:ring-0 py-2 font-body-md"
                />
              </div>

              {/* Notes */}
              <div className="flex flex-col gap-1.5 mt-2">
                <label className="font-label-md text-xs text-on-surface-variant uppercase">Reservation Notes</label>
                <textarea
                  value={resNotes}
                  onChange={(e) => setResNotes(e.target.value)}
                  rows={2}
                  placeholder="E.g. Wants to try on this Saturday..."
                  className="w-full bg-transparent border-0 border-b border-outline-variant focus:border-primary focus:ring-0 py-2 font-body-md resize-none"
                />
              </div>

              {resError && (
                <div className="text-error font-body-md text-xs bg-error-container/20 p-2 rounded">
                  {resError}
                </div>
              )}

              <div className="flex justify-end gap-4 mt-6 pt-4 border-t border-outline-variant/10">
                <button
                  type="button"
                  onClick={() => {
                    setIsReserveOpen(false);
                    setResError('');
                  }}
                  className="px-4 py-2 border border-outline text-on-surface rounded font-label-sm uppercase tracking-wider text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-2 bg-primary text-on-primary rounded font-label-sm uppercase tracking-wider text-xs hover:opacity-90 disabled:opacity-50"
                >
                  {isPending ? 'Saving...' : 'Confirm Reservation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Mark Sold Modal */}
      {isSaleOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-8 max-w-md w-full shadow-2xl relative">
            <h3 className="font-display font-semibold text-headline-sm text-on-surface mb-6">
              Record Boutique Sale
            </h3>

            <form onSubmit={handleSaleSubmit} className="flex flex-col gap-5">
              {/* Customer Select */}
              <div className="flex flex-col gap-1.5">
                <label className="font-label-md text-xs text-on-surface-variant uppercase">Select Customer</label>
                <select
                  required
                  value={saleCustomerId}
                  onChange={(e) => setSaleCustomerId(e.target.value)}
                  className="w-full bg-transparent border-0 border-b border-outline-variant focus:border-primary focus:ring-0 py-2 font-body-md"
                >
                  <option value="">-- Choose Client --</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.mobile})
                    </option>
                  ))}
                </select>
              </div>

              {/* Price */}
              <div className="flex flex-col gap-1.5 mt-2">
                <label className="font-label-md text-xs text-on-surface-variant uppercase">Final Sale Price (INR)</label>
                <input
                  type="number"
                  required
                  value={salePrice}
                  onChange={(e) => setSalePrice(e.target.value)}
                  className="w-full bg-transparent border-0 border-b border-outline-variant focus:border-primary focus:ring-0 py-2 font-body-md"
                />
              </div>

              {/* Payment Status */}
              <div className="flex flex-col gap-1.5 mt-2">
                <label className="font-label-md text-xs text-on-surface-variant uppercase">Payment Status</label>
                <div className="flex gap-4 mt-1">
                  <label className="flex items-center gap-2 font-body-md cursor-pointer">
                    <input
                      type="radio"
                      name="paymentStatus"
                      checked={salePaymentStatus === 'PAID'}
                      onChange={() => setSalePaymentStatus('PAID')}
                      className="text-primary focus:ring-primary border-outline"
                    />
                    Paid
                  </label>
                  <label className="flex items-center gap-2 font-body-md cursor-pointer">
                    <input
                      type="radio"
                      name="paymentStatus"
                      checked={salePaymentStatus === 'UNPAID'}
                      onChange={() => setSalePaymentStatus('UNPAID')}
                      className="text-primary focus:ring-primary border-outline"
                    />
                    Unpaid / Pending
                  </label>
                </div>
              </div>

              {/* Notes */}
              <div className="flex flex-col gap-1.5 mt-2">
                <label className="font-label-md text-xs text-on-surface-variant uppercase">Sale Notes</label>
                <textarea
                  value={saleNotes}
                  onChange={(e) => setSaleNotes(e.target.value)}
                  rows={2}
                  placeholder="E.g. Bank transfer completed..."
                  className="w-full bg-transparent border-0 border-b border-outline-variant focus:border-primary focus:ring-0 py-2 font-body-md resize-none"
                />
              </div>

              {saleError && (
                <div className="text-error font-body-md text-xs bg-error-container/20 p-2 rounded">
                  {saleError}
                </div>
              )}

              <div className="flex justify-end gap-4 mt-6 pt-4 border-t border-outline-variant/10">
                <button
                  type="button"
                  onClick={() => {
                    setIsSaleOpen(false);
                    setSaleError('');
                  }}
                  className="px-4 py-2 border border-outline text-on-surface rounded font-label-sm uppercase tracking-wider text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-2 bg-primary text-on-primary rounded font-label-sm uppercase tracking-wider text-xs hover:opacity-90 disabled:opacity-50"
                >
                  {isPending ? 'Recording...' : 'Confirm Sale'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Printable Price Tag (Only visible when printing) */}
      <div 
        id="single-price-tag-print-area" 
        className="hidden print:flex items-center justify-center fixed inset-0 bg-white z-[99999] m-0 p-0 text-black font-sans"
      >
        <PriceTag product={product} />
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page {
            size: 2.5in 1.5in;
            margin: 0;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            width: 2.5in !important;
            height: 1.5in !important;
            overflow: hidden !important;
            background: white !important;
          }
          body > *:not(#single-price-tag-print-area) {
            display: none !important;
          }
          #single-price-tag-print-area {
            display: flex !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 2.5in !important;
            height: 1.5in !important;
            margin: 0 !important;
            padding: 2px !important;
            background: white !important;
            align-items: center !important;
            justify-content: center !important;
          }
        }
      ` }} />
    </div>
  );
}
