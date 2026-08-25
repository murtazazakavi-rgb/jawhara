'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { cancelReservationAction } from '../actions';

interface Reservation {
  id: string;
  expiresAt: string | null;
  product: {
    id: string;
    productCode: string;
    name: string;
    price: number;
    images: { url: string }[];
  };
}

interface Order {
  id: string;
  orderNumber: string;
  total: number;
  status: string;
  paymentStatus: string;
  createdAt: string;
  paymentRequestUrl: string | null;
}

interface ShopDashboardClientProps {
  customerName: string;
  activeHolds: Reservation[];
  orders: Order[];
}

export default function ShopDashboardClient({
  customerName,
  activeHolds,
  orders,
}: ShopDashboardClientProps) {
  const router = useRouter();
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  // Expiration timers state
  const [timeRemaining, setTimeRemaining] = useState<Record<string, string>>({});

  useEffect(() => {
    const updateTimers = () => {
      const newTimers: Record<string, string> = {};
      activeHolds.forEach((hold) => {
        if (!hold.expiresAt) {
          newTimers[hold.id] = 'No Limit';
          return;
        }
        
        const expiry = new Date(hold.expiresAt).getTime();
        const now = Date.now();
        const diff = expiry - now;

        if (diff <= 0) {
          newTimers[hold.id] = 'Expired / Processing release';
        } else {
          const minutes = Math.floor(diff / 60000);
          const seconds = Math.floor((diff % 60000) / 1000);
          newTimers[hold.id] = `${minutes}m ${seconds}s remaining`;
        }
      });
      setTimeRemaining(newTimers);
    };

    updateTimers();
    const interval = setInterval(updateTimers, 1000);
    return () => clearInterval(interval);
  }, [activeHolds]);

  const handleCancelHold = async (reservationId: string) => {
    if (!confirm('Are you sure you want to release this piece? It will be immediately made available for other boutique customers.')) {
      return;
    }

    setCancellingId(reservationId);
    try {
      const res = await cancelReservationAction(reservationId);
      if (res.error) {
        alert(res.error);
      } else {
        alert('Piece released back to inventory.');
        router.refresh();
      }
    } catch (err) {
      console.error(err);
      alert('Failed to release piece.');
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <div className="bg-surface text-on-surface min-h-screen font-body-md flex flex-col relative overflow-x-hidden">
      {/* Rose Watermark background */}
      <div className="fixed inset-0 rose-watermark opacity-[0.02] z-0 pointer-events-none"></div>

      {/* Header bar */}
      <header className="w-full py-6 border-b border-outline-variant/20 bg-surface-container-lowest z-10 sticky top-0 shadow-sm">
        <div className="max-w-container-max mx-auto px-4 sm:px-6 md:px-8 flex justify-between items-center">
          <Link href="/shop" className="flex items-center gap-2 text-primary hover:opacity-80 transition-opacity">
            <span className="material-symbols-outlined">arrow_back</span>
            <span className="font-label-md uppercase tracking-wider text-xs">Back to Gallery</span>
          </Link>
          <div className="text-right">
            <span className="font-label-md text-xs text-outline uppercase tracking-wider block">Customer Dashboard</span>
            <span className="font-body-md text-sm text-on-surface font-semibold">{customerName}</span>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-container-max w-full mx-auto px-4 sm:px-6 md:px-8 py-10 flex-grow relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Active Holds */}
        <section className="lg:col-span-6 space-y-6">
          <h2 className="font-display text-2xl text-primary font-light border-b border-outline-variant/20 pb-3 flex items-center gap-2">
            <span className="material-symbols-outlined">lock</span>
            My Active Holds
          </h2>

          {activeHolds.length === 0 ? (
            <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-8 text-center space-y-3">
              <span className="material-symbols-outlined text-outline/30 text-5xl">inventory_2</span>
              <p className="font-body-md text-on-surface-variant italic text-sm">You have no items currently on hold.</p>
              <Link
                href="/shop"
                className="inline-block bg-primary text-white text-xs font-label-md uppercase tracking-wider px-4 py-2 rounded-lg hover:opacity-90 transition-opacity"
              >
                Browse Pieces
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {activeHolds.map((hold) => {
                const img = hold.product.images[0]?.url || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150';
                return (
                  <div 
                    key={hold.id}
                    className="bg-surface-container-lowest border border-[#E4C8CF] rounded-xl p-4 flex gap-4 shadow-sm relative overflow-hidden"
                  >
                    {/* Pink accent side bar for active holds */}
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#E4C8CF]"></div>
                    
                    <div className="w-20 h-24 bg-surface-container-low rounded-lg overflow-hidden shrink-0">
                      <img src={img} alt={hold.product.name} className="w-full h-full object-cover" />
                    </div>

                    <div className="flex-grow flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-start gap-2">
                          <h3 className="font-label-md text-sm text-on-surface font-semibold line-clamp-1">
                            {hold.product.name}
                          </h3>
                          <span className="font-mono text-[10px] text-outline shrink-0">{hold.product.productCode}</span>
                        </div>
                        <p className="font-headline-sm text-primary text-xs font-semibold mt-1">
                          ₹{hold.product.price.toLocaleString('en-IN')}
                        </p>
                      </div>

                      <div className="mt-3 flex items-center justify-between gap-2 pt-2 border-t border-outline-variant/10">
                        <span className="text-xs font-label-sm text-error font-semibold flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px]">schedule</span>
                          {timeRemaining[hold.id] || 'Calculating...'}
                        </span>

                        <button
                          onClick={() => handleCancelHold(hold.id)}
                          disabled={cancellingId === hold.id}
                          className="text-[10px] font-label-md text-error hover:underline uppercase tracking-wider cursor-pointer disabled:opacity-50"
                        >
                          Release Hold
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Right Column: Invoice / Orders History */}
        <section className="lg:col-span-6 space-y-6">
          <h2 className="font-display text-2xl text-primary font-light border-b border-outline-variant/20 pb-3 flex items-center gap-2">
            <span className="material-symbols-outlined">receipt_long</span>
            Purchase & Invoice History
          </h2>

          {orders.length === 0 ? (
            <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-8 text-center">
              <p className="font-body-md text-on-surface-variant italic text-sm">No transaction records found.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {orders.map((ord) => (
                <div 
                  key={ord.id}
                  className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-4 space-y-3 shadow-sm"
                >
                  <div className="flex justify-between items-center border-b border-outline-variant/10 pb-2">
                    <div>
                      <span className="font-label-md text-sm text-on-surface font-semibold">Order {ord.orderNumber}</span>
                      <span className="text-[10px] text-outline ml-3">{new Date(ord.createdAt).toLocaleDateString()}</span>
                    </div>
                    
                    <div className="flex gap-2">
                      <span className={`text-[9px] font-label-sm px-2 py-0.5 rounded uppercase border font-semibold ${
                        ord.paymentStatus === 'PAID'
                          ? 'bg-success/10 text-success border-success/20'
                          : 'bg-error/10 text-error border-error/20'
                      }`}>
                        {ord.paymentStatus}
                      </span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-xs">
                    <div>
                      <span className="text-outline">Order Status: </span>
                      <span className="font-semibold text-on-surface-variant uppercase">{ord.status}</span>
                    </div>
                    <div>
                      <span className="text-outline">Amount: </span>
                      <span className="font-headline-sm text-primary font-bold">₹{ord.total.toLocaleString('en-IN')}</span>
                    </div>
                  </div>

                  {ord.paymentStatus === 'UNPAID' && (
                    <div className="pt-2 border-t border-outline-variant/10 flex justify-end">
                      {ord.paymentRequestUrl ? (
                        <Link
                          href={ord.paymentRequestUrl}
                          className="bg-primary text-white text-[10px] font-label-md uppercase tracking-wider px-3.5 py-1.5 rounded hover:opacity-90 transition-opacity flex items-center gap-1"
                        >
                          <span className="material-symbols-outlined text-[12px]">payments</span>
                          Complete Payment
                        </Link>
                      ) : (
                        <span className="text-[10px] font-label-md text-outline italic uppercase tracking-wider">
                          Payment Link Pending Staff Approval
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Footer */}
      <footer className="w-full py-8 border-t border-outline-variant/20 bg-surface-container-lowest mt-16 text-center">
        <p className="text-[10px] font-mono text-outline">
          © {new Date().getFullYear()} Maison Jawhara. Customer Dashboard.
        </p>
      </footer>
    </div>
  );
}
