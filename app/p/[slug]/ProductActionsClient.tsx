'use client';

import React, { useState, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Script from 'next/script';
import { 
  reserveProductAction,
  cancelReservationAction,
  clientCheckoutAction 
} from '../../shop/actions';

interface ProductActionsClientProps {
  productId: string;
  productSlug: string;
  productName: string;
  productPrice: number;
  inventoryStatus: string;
  isUnique: boolean;
  quantity: number;
  customer: {
    id: string;
    name: string;
    email: string | null;
    mobile: string | null;
    normalizedMobile: string | null;
  } | null;
  activeReservation: {
    id: string;
    customerId: string;
    expiresAt: string | null;
  } | null;
  waUrl: string;
}

export default function ProductActionsClient({
  productId,
  productSlug,
  productName,
  productPrice,
  inventoryStatus,
  isUnique,
  quantity,
  customer,
  activeReservation,
  waUrl,
}: ProductActionsClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState('');
  const [timerText, setTimerText] = useState('Reserved');

  // Real-time hold countdown timer
  useEffect(() => {
    if (inventoryStatus !== 'RESERVED' || !activeReservation?.expiresAt) return;

    const updateTimer = () => {
      const diff = new Date(activeReservation.expiresAt!).getTime() - Date.now();
      if (diff <= 0) {
        setTimerText('Expired');
        router.refresh();
      } else {
        const mins = Math.floor(diff / 60000);
        const secs = Math.floor((diff % 60000) / 1000);
        setTimerText(`${mins}m ${secs}s`);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [inventoryStatus, activeReservation, router]);

  // Reservation handler
  const handleReserve = async () => {
    if (!customer) {
      router.push(`/login?redirect=/p/${productSlug}`);
      return;
    }

    if (!confirm('Place a temporary hold on this item for 20 minutes? Other users will see it as reserved.')) {
      return;
    }

    startTransition(async () => {
      setError('');
      const res = await reserveProductAction(productId);
      if (res.error) {
        alert(res.error);
      } else {
        alert('Item placed on hold successfully! You can complete your checkout now.');
        router.refresh();
      }
    });
  };

  // Cancel hold reservation
  const handleCancelHold = async () => {
    if (!activeReservation) return;
    if (!confirm('Are you sure you want to release this piece? It will be immediately made available for other boutique customers.')) {
      return;
    }

    startTransition(async () => {
      setError('');
      const res = await cancelReservationAction(activeReservation.id);
      if (res.error) {
        alert(res.error);
      } else {
        alert('Piece released back to inventory.');
        router.refresh();
      }
    });
  };

  // Checkout payment handler
  const handleCheckout = async () => {
    if (!activeReservation) return;
    startTransition(async () => {
      setError('');
      const res = await clientCheckoutAction({ reservationId: activeReservation.id });
      if (res.error) {
        alert(res.error);
      } else if (res.useStandardCheckout) {
        // Standard Razorpay Checkout Modal
        const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || 'rzp_test_TUMOjBupLIHjyd';
        const options = {
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
                headers: {
                  'Content-Type': 'application/json',
                },
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

              alert('Payment successful! Your order has been placed and is being processed.');
              router.refresh();
            } catch (verifyErr: any) {
              console.error(verifyErr);
              alert(`Verification Error: ${verifyErr.message}`);
            }
          },
          prefill: {
            name: res.customerName,
            email: res.customerEmail || undefined,
            contact: res.customerMobile || undefined,
          },
          theme: {
            color: '#755566', // Mauve
          },
        };

        const rzp = new (window as any).Razorpay(options);
        rzp.on('payment.failed', function (response: any) {
          alert(`Payment failed: ${response.error.description}`);
        });
        rzp.open();
      } else if (res.paymentUrl) {
        window.open(res.paymentUrl, '_blank');
        alert('Checkout initiated! A payment page has opened in a new tab. Once payment succeeds, your order status will be updated on your dashboard.');
        router.refresh();
      } else {
        alert('Checkout initiated successfully.');
        router.refresh();
      }
    });
  };

  // Direct checkout handler (Buy Now on available item)
  const handleBuyNowDirect = async () => {
    if (!customer) {
      router.push(`/login?redirect=/p/${productSlug}`);
      return;
    }

    startTransition(async () => {
      setError('');
      // 1. Reserve first
      const reserveRes = await reserveProductAction(productId);
      if (reserveRes.error) {
        alert(reserveRes.error);
        return;
      }

      const reservationId = reserveRes.reservation?.id;
      if (!reservationId) {
        alert('Failed to place hold before checkout.');
        return;
      }

      // 2. Trigger checkout immediately
      const checkoutRes = await clientCheckoutAction({ reservationId });
      if (checkoutRes.error) {
        alert(checkoutRes.error);
      } else if (checkoutRes.useStandardCheckout) {
        const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || 'rzp_test_TUMOjBupLIHjyd';
        const options = {
          key: keyId,
          amount: checkoutRes.amount,
          currency: checkoutRes.currency || 'INR',
          name: 'Jawhara',
          description: `Payment for Order ${checkoutRes.orderNumber}`,
          order_id: checkoutRes.razorpayOrderId,
          handler: async function (response: any) {
            try {
              const verifyRes = await fetch('/api/verify-payment', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
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

              alert('Payment successful! Your order has been placed and is being processed.');
              router.refresh();
            } catch (verifyErr: any) {
              console.error(verifyErr);
              alert(`Verification Error: ${verifyErr.message}`);
            }
          },
          prefill: {
            name: checkoutRes.customerName,
            email: checkoutRes.customerEmail || undefined,
            contact: checkoutRes.customerMobile || undefined,
          },
          theme: {
            color: '#755566', // Mauve
          },
        };

        const rzp = new (window as any).Razorpay(options);
        rzp.on('payment.failed', function (response: any) {
          alert(`Payment failed: ${response.error.description}`);
        });
        rzp.open();
      } else if (checkoutRes.paymentUrl) {
        window.open(checkoutRes.paymentUrl, '_blank');
        alert('Checkout initiated! A payment page has opened in a new tab. Once payment succeeds, your order status will be updated on your dashboard.');
        router.refresh();
      } else {
        alert('Checkout initiated successfully.');
        router.refresh();
      }
    });
  };

  const isSold = inventoryStatus === 'SOLD';
  const isReserved = inventoryStatus === 'RESERVED';
  const isReservedByMe = isReserved && activeReservation && customer && activeReservation.customerId === customer.id;

  return (
    <div className="w-full font-body-md">
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />

      {isSold ? (
        <div className="bg-surface-container p-6 rounded-lg border border-outline-variant/20 text-center">
          <p className="font-display text-on-surface text-lg mb-2">This piece has found its home.</p>
          <p className="font-body-md text-on-surface-variant text-sm">
            Each Jawhara design is a handcrafted masterpiece. Inquire to create a bespoke piece inspired by this design.
          </p>
          <a
            href={waUrl}
            target="_blank"
            className="mt-4 bg-primary text-on-primary font-label-md py-3.5 px-6 rounded uppercase tracking-wider text-xs inline-flex items-center gap-2 hover:opacity-90 transition-opacity"
          >
            <span className="material-symbols-outlined text-sm">chat</span> Custom Inquiry
          </a>
        </div>
      ) : isReservedByMe ? (
        <div className="bg-success/5 border border-success/20 p-6 rounded-xl space-y-4 shadow-sm">
          <div className="text-success font-semibold flex items-center gap-2 text-sm justify-center">
            <span className="material-symbols-outlined text-base">lock</span>
            You have placed this piece on hold ({timerText} remaining)
          </div>
          <p className="text-xs text-on-surface-variant text-center leading-relaxed">
            Complete your checkout to purchase. If the timer expires, the hold will release back to general inventory.
          </p>
          <div className="flex flex-col gap-2.5">
            <button
              onClick={handleCheckout}
              disabled={isPending}
              className="w-full bg-primary text-on-primary font-label-md py-4 px-6 rounded uppercase tracking-wider text-xs hover:opacity-90 transition-opacity flex justify-center items-center gap-2 shadow-sm cursor-pointer disabled:opacity-50"
            >
              {isPending ? 'Processing...' : 'Buy Now (Complete Purchase)'}
            </button>
            <button
              onClick={handleCancelHold}
              disabled={isPending}
              className="w-full border border-outline text-on-surface-variant font-label-md py-3 px-6 rounded uppercase tracking-wider text-xs hover:bg-surface-container-low transition-colors flex justify-center items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              Cancel Hold & Release Stock
            </button>
          </div>
        </div>
      ) : isReserved ? (
        <div className="bg-surface-container/50 p-6 rounded-lg border border-outline-variant/20 text-center space-y-4">
          <div className="text-error font-semibold flex items-center justify-center gap-2 text-sm">
            <span className="material-symbols-outlined text-base">schedule</span>
            On Hold (Reserved by another client: {timerText})
          </div>
          <p className="text-xs text-on-surface-variant leading-relaxed">
            This piece is currently on hold. Holds expire automatically after 20 minutes if unpaid. You can inquire about this piece via WhatsApp.
          </p>
          <a
            href={waUrl}
            target="_blank"
            className="w-full bg-primary text-on-primary font-label-md py-3.5 px-6 rounded uppercase tracking-wider text-xs inline-flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
          >
            <span className="material-symbols-outlined text-sm">chat</span> Inquire on WhatsApp
          </a>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <button
            onClick={handleBuyNowDirect}
            disabled={isPending}
            className="w-full bg-primary text-on-primary font-label-md py-4 px-6 rounded uppercase tracking-wider text-xs hover:opacity-90 transition-opacity flex justify-center items-center gap-2 shadow-sm cursor-pointer disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-base">shopping_cart</span>
            Buy Now
          </button>
          <button
            onClick={handleReserve}
            disabled={isPending}
            className="w-full border border-primary text-primary font-label-md py-3.5 px-6 rounded uppercase tracking-wider text-xs hover:bg-primary/5 transition-colors flex justify-center items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-base">lock</span>
            Reserve (20 min Hold)
          </button>
          <a
            href={waUrl}
            target="_blank"
            className="w-full border border-outline text-on-surface-variant font-label-md py-3 px-6 rounded uppercase tracking-wider text-xs hover:bg-surface-container-low transition-colors flex justify-center items-center gap-2"
          >
            <span className="material-symbols-outlined text-sm">chat</span> Ask on WhatsApp
          </a>
        </div>
      )}
    </div>
  );
}
