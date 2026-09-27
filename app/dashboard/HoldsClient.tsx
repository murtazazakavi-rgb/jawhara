'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import Script from 'next/script';
import { cancelReservationAction, clientCheckoutAction } from '../shop/actions';
import CheckoutModal from '@/components/CheckoutModal';
import CustomerPageHeader from '@/components/CustomerPageHeader';
import { useToast } from '@/components/Toast';

interface Hold {
  id: string;
  expiresAt: string | null;
  product: {
    id: string;
    productCode: string;
    name: string;
    price: number;
    slug: string;
    images: { url: string }[];
  };
}

interface HoldsClientProps {
  customerName: string;
  activeHolds: Hold[];
}

/** Milliseconds left on a hold, or null when it has no expiry. */
function msLeft(expiresAt: string | null, now: number) {
  return expiresAt ? new Date(expiresAt).getTime() - now : null;
}

function formatCountdown(ms: number) {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export default function HoldsClient({ customerName, activeHolds }: HoldsClientProps) {
  const router = useRouter();
  const toast = useToast();
  const [now, setNow] = useState(() => Date.now());
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [checkingOutId, setCheckingOutId] = useState<string | null>(null);
  const [checkoutHold, setCheckoutHold] = useState<Hold | null>(null);

  // Tick every second; refresh once when any hold runs out so it disappears
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const hasExpired = activeHolds.some((h) => {
    const left = msLeft(h.expiresAt, now);
    return left !== null && left <= 0;
  });
  useEffect(() => {
    if (hasExpired) router.refresh();
  }, [hasExpired, router]);

  const handleRelease = async (hold: Hold) => {
    if (!confirm(`Release "${hold.product.name}"? It will go back on sale for other customers.`)) return;
    setCancellingId(hold.id);
    try {
      const res = await cancelReservationAction(hold.id);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.info('Hold released.');
        router.refresh();
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to release hold.');
    } finally {
      setCancellingId(null);
    }
  };

  const handleCheckout = async (hold: Hold, notes?: string) => {
    setCheckingOutId(hold.id);
    try {
      const res = await clientCheckoutAction({ reservationId: hold.id, notes });
      if (res.error) {
        toast.error(res.error);
        setCheckingOutId(null);
      } else if (res.useStandardCheckout) {
        const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
        if (!keyId) {
          toast.error('Online payment is not available right now.');
          setCheckingOutId(null);
          return;
        }

        const rzp = new (window as any).Razorpay({
          key: keyId,
          amount: res.amount,
          currency: res.currency || 'INR',
          name: 'Jawhara',
          description: `Payment for Order ${res.orderNumber}`,
          order_id: res.razorpayOrderId,
          handler: async function (response: any) {
            try {
              const verifyRes = await fetch('/api/verify-payment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                }),
              });
              const verifyData = await verifyRes.json();
              if (!verifyRes.ok) {
                throw new Error(verifyData.error || 'Payment signature verification failed.');
              }
              toast.success('Payment successful! Your order has been placed.');
              if (verifyData.orderId) {
                router.push(`/orders/${verifyData.orderId}/receipt`);
              } else {
                router.push('/account');
              }
            } catch (verifyErr: any) {
              console.error(verifyErr);
              toast.error(`Verification Error: ${verifyErr.message}`);
            } finally {
              setCheckingOutId(null);
            }
          },
          prefill: {
            name: res.customerName,
            email: res.customerEmail || undefined,
            contact: res.customerMobile || undefined,
          },
          theme: { color: '#755566' },
          modal: {
            ondismiss: function () {
              setCheckingOutId(null);
              toast.info('Payment not completed. Your piece is still on hold — pay any time before the timer runs out.');
            },
          },
        });
        rzp.on('payment.failed', function (response: any) {
          toast.error(`Payment failed: ${response.error.description}`);
          setCheckingOutId(null);
        });
        rzp.open();
      } else if (res.paymentUrl) {
        window.open(res.paymentUrl, '_blank');
        toast.info('A payment page has opened in a new tab.');
        router.refresh();
        setCheckingOutId(null);
      } else {
        toast.success('Checkout started.');
        router.refresh();
        setCheckingOutId(null);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to start checkout.');
      setCheckingOutId(null);
    }
  };

  return (
    <div className="bg-surface text-on-surface min-h-screen font-body-md flex flex-col">
      <CustomerPageHeader title="My Holds" subtitle={customerName} />

      <main className="max-w-3xl w-full mx-auto px-4 sm:px-6 py-6 flex-grow space-y-4">
        <p className="text-sm text-on-surface-variant">
          Pieces are held for you for a short time. Pay before the timer runs out to make them yours.
        </p>

        {activeHolds.length === 0 ? (
          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-8 text-center space-y-3">
            <span className="material-symbols-outlined text-outline/40 text-5xl">schedule</span>
            <p className="text-base text-on-surface">Nothing on hold right now.</p>
            <p className="text-sm text-on-surface-variant">Tap “Hold” on any available piece to keep it for yourself while you decide.</p>
            <Link
              href="/"
              className="inline-flex items-center justify-center h-11 px-6 bg-primary text-on-primary text-sm font-semibold rounded-full hover:opacity-90 transition-opacity"
            >
              Browse pieces
            </Link>
          </div>
        ) : (
          activeHolds.map((hold) => {
            const left = msLeft(hold.expiresAt, now);
            const expired = left !== null && left <= 0;
            const urgent = left !== null && left < 5 * 60 * 1000;
            const busy = cancellingId === hold.id || checkingOutId === hold.id;
            const img = hold.product.images[0]?.url;

            return (
              <article
                key={hold.id}
                className={`bg-surface-container-lowest border rounded-xl p-4 shadow-sm ${urgent ? 'border-error/40' : 'border-outline-variant/30'}`}
              >
                <div className="flex gap-4">
                  <Link
                    href={`/p/${hold.product.slug}`}
                    className="relative w-20 h-24 rounded-lg overflow-hidden shrink-0 bg-surface-container-low flex items-center justify-center"
                  >
                    {img ? (
                      <Image src={img} alt={hold.product.name} fill sizes="80px" className="object-cover" />
                    ) : (
                      <span className="material-symbols-outlined text-outline/50">image</span>
                    )}
                  </Link>

                  <div className="flex-grow min-w-0 flex flex-col">
                    <Link href={`/p/${hold.product.slug}`} className="text-base font-semibold text-on-surface line-clamp-2 hover:text-primary">
                      {hold.product.name}
                    </Link>
                    <p className="text-base text-primary font-semibold mt-0.5">
                      ₹{hold.product.price.toLocaleString('en-IN')}
                    </p>

                    <div
                      className={`mt-auto pt-2 flex items-center gap-1.5 ${urgent ? 'text-error' : 'text-on-surface-variant'}`}
                      aria-live="polite"
                    >
                      <span className="material-symbols-outlined text-[20px]">timer</span>
                      {left === null ? (
                        <span className="text-sm">Held for you</span>
                      ) : expired ? (
                        <span className="text-sm">Hold ended</span>
                      ) : (
                        <span className="text-sm">
                          <strong className="text-lg tabular-nums">{formatCountdown(left)}</strong> left
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => handleRelease(hold)}
                    disabled={busy || expired}
                    className="h-11 px-4 rounded-full border border-outline-variant text-on-surface-variant text-sm hover:border-error hover:text-error transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    {cancellingId === hold.id ? 'Releasing…' : 'Release'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCheckoutHold(hold)}
                    disabled={busy || expired}
                    className="flex-1 h-11 rounded-full bg-primary text-on-primary text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[18px]">lock_open</span>
                    {checkingOutId === hold.id ? 'Opening payment…' : `Pay ₹${hold.product.price.toLocaleString('en-IN')}`}
                  </button>
                </div>
              </article>
            );
          })
        )}

        <Link
          href="/account"
          className="flex items-center justify-between gap-3 bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-4 text-sm text-on-surface hover:border-primary/40 transition-colors"
        >
          <span className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">receipt_long</span>
            Orders, receipts & messages are in your Account
          </span>
          <span className="material-symbols-outlined text-outline">chevron_right</span>
        </Link>
      </main>

      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
      <CheckoutModal
        isOpen={checkoutHold !== null}
        onClose={() => setCheckoutHold(null)}
        onConfirm={(notes) => {
          if (checkoutHold) {
            handleCheckout(checkoutHold, notes);
          }
          setCheckoutHold(null);
        }}
        price={checkoutHold?.product.price || 0}
      />
    </div>
  );
}
