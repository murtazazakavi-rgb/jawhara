'use client';

import React, { useState, useTransition } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { releaseReservation } from './[id]/actions';
import { useToast } from '@/components/Toast';

interface Customer {
  id: string;
  name: string;
  email: string;
  mobile: string | null;
}

interface Reservation {
  id: string;
  expiresAt: string | null;
  customer: Customer;
}

interface Product {
  id: string;
  productCode: string;
  name: string;
  price: any;
  images: { url: string }[];
  reservations: Reservation[];
}

interface ReservedProductsListProps {
  products: Product[];
}

export default function ReservedProductsList({ products }: ReservedProductsListProps) {
  const router = useRouter();
  const toast = useToast();
  const [isPending, startTransition] = useTransition();
  const [releasingId, setReleasingId] = useState<string | null>(null);

  const handleRelease = (productId: string, productName: string) => {
    setReleasingId(productId);
    startTransition(async () => {
      try {
        const res = await releaseReservation({ productId });
        if (res.error) {
          toast.error(res.error);
        } else {
          toast.success(`Hold on "${productName}" released.`);
          router.refresh();
        }
      } catch (e) {
        toast.error('An unexpected error occurred while releasing the hold.');
      } finally {
        setReleasingId(null);
      }
    });
  };

  // Helper to calculate time remaining in text format
  const getTimeRemaining = (expiresAtStr: string | null) => {
    if (!expiresAtStr) return 'No expiry';
    const diff = new Date(expiresAtStr).getTime() - Date.now();
    if (diff <= 0) return 'Expired';
    
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) {
      return `${minutes}m remaining`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m remaining`;
  };

  const reservedItems = products.filter(p => p.reservations && p.reservations.length > 0);

  if (reservedItems.length === 0) {
    return (
      <div className="bg-surface-container-lowest text-center rounded-xl p-16 border border-outline-variant/30">
        <span className="material-symbols-outlined text-outline/30 text-6xl mb-4">bookmark_border</span>
        <h3 className="font-headline-md text-on-surface mb-2">No active holds found.</h3>
        <p className="font-body-md text-on-surface-variant max-w-md mx-auto">
          There are no products currently reserved by clients. All published items are fully available.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-6 md:p-8 shadow-sm">
      <h3 className="font-display font-medium text-headline-sm text-primary mb-6">Active Reservations Tracking</h3>
      
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-outline-variant/30">
              <th className="font-label-md text-xs text-outline uppercase py-3 pr-4">Image</th>
              <th className="font-label-md text-xs text-outline uppercase py-3 pr-4">Item Details</th>
              <th className="font-label-md text-xs text-outline uppercase py-3 pr-4">Retail Price</th>
              <th className="font-label-md text-xs text-outline uppercase py-3 pr-4">Reserved By</th>
              <th className="font-label-md text-xs text-outline uppercase py-3 pr-4">Time Left</th>
              <th className="font-label-md text-xs text-outline uppercase py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {reservedItems.map((product) => {
              const mainImg = product.images[0]?.url || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100';
              const reservation = product.reservations[0];
              const customer = reservation.customer;
              const timeText = getTimeRemaining(reservation.expiresAt);
              
              return (
                <tr 
                  key={product.id} 
                  className="border-b border-outline-variant/10 hover:bg-surface-container-low/10 transition-colors"
                >
                  {/* Thumbnail */}
                  <td className="py-4 pr-4">
                    <div className="w-10 h-12 bg-surface-container-low rounded overflow-hidden border border-outline-variant/10 shrink-0 relative">
                      <Image src={mainImg} alt={product.name} fill sizes="40px" className="object-cover" />
                    </div>
                  </td>

                  {/* Code & Name */}
                  <td className="py-4 pr-4">
                    <div className="flex flex-col">
                      <Link 
                        href={`/products/${product.id}`}
                        className="font-body-md text-sm font-semibold text-on-surface hover:underline hover:text-primary transition-colors"
                      >
                        {product.name}
                      </Link>
                      <span className="font-mono text-[10px] text-outline uppercase tracking-wider mt-0.5">
                        {product.productCode}
                      </span>
                    </div>
                  </td>

                  {/* Price */}
                  <td className="font-body-md text-sm py-4 pr-4 text-on-surface font-semibold">
                    ₹{Number(product.price).toLocaleString('en-IN')}
                  </td>

                  {/* Customer context */}
                  <td className="py-4 pr-4">
                    <div className="flex flex-col">
                      <Link 
                        href={`/customers/${customer.id}`}
                        className="font-body-md text-sm font-semibold text-primary hover:underline"
                      >
                        {customer.name}
                      </Link>
                      <span className="text-[11px] text-on-surface-variant/80">
                        {customer.email}
                      </span>
                      {customer.mobile && (
                        <span className="text-[11px] text-outline">
                          {customer.mobile}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Hold Timer */}
                  <td className="py-4 pr-4">
                    <span className={`text-xs font-label-md font-bold ${
                      timeText === 'Expired' ? 'text-error' : 'text-secondary'
                    }`}>
                      {timeText}
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="py-4 text-right">
                    <button
                      onClick={() => handleRelease(product.id, product.name)}
                      disabled={releasingId === product.id || isPending}
                      className="px-3.5 py-1.5 bg-error/10 hover:bg-error text-error hover:text-white rounded text-xs font-label-md uppercase tracking-wider transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      {releasingId === product.id ? 'Releasing...' : 'Release Hold'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
