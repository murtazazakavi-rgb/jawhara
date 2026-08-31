'use client';

import React, { useState, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Script from 'next/script';
import CheckoutModal from '@/components/CheckoutModal';
import { useToast } from '@/components/Toast';
import { 
  reserveProductAction,
  cancelReservationAction,
  clientCheckoutAction,
  clientGuestRegisterAction
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
  productCode?: string;
  productImage?: string | null;
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
  productCode = '',
  productImage = null,
}: ProductActionsClientProps) {
  const router = useRouter();
  const toast = useToast();
  const [activeCustomer, setActiveCustomer] = useState(customer);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState('');
  const [timerText, setTimerText] = useState('Reserved');
  const [addedToCart, setAddedToCart] = useState(false);
  
  // Checkout Modal State
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [checkoutType, setCheckoutType] = useState<'DIRECT' | 'HELD'>('DIRECT');

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

  // Cart handler
  const handleAddToCart = () => {
    try {
      const currentCart = JSON.parse(localStorage.getItem('jawhara_cart') || '[]');
      const existing = currentCart.find((item: any) => item.id === productId);

      if (existing) {
        if (isUnique) {
          toast.warning('This unique piece is already in your cart.');
          return;
        }
        if (existing.quantity >= quantity) {
          toast.warning(`Maximum available quantity (${quantity}) added.`);
          return;
        }
        existing.quantity += 1;
        toast.info(`Increased "${productName}" quantity to ${existing.quantity}.`);
      } else {
        currentCart.push({
          id: productId,
          productCode,
          name: productName,
          price: productPrice,
          slug: productSlug,
          image: productImage,
          isUnique,
          maxQuantity: quantity,
          quantity: 1,
        });
        toast.success(`"${productName}" added to cart!`);
      }
      localStorage.setItem('jawhara_cart', JSON.stringify(currentCart));
      window.dispatchEvent(new Event('jawhara_cart_updated'));
      setAddedToCart(true);
      setTimeout(() => setAddedToCart(false), 2000);
    } catch (e) {
      console.error(e);
      toast.error('Failed to add item to cart.');
    }
  };

  // Reservation handler
  const handleReserve = async () => {
    if (!activeCustomer) {
      toast.warning('Please sign in or register to place this item on hold.');
      router.push(`/login?redirect=/p/${productSlug}`);
      return;
    }

    startTransition(async () => {
      setError('');
      const res = await reserveProductAction(productId);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success('Piece placed on hold for 20 minutes! You can complete purchase now.');
        router.refresh();
      }
    });
  };

  // Cancel hold reservation
  const handleCancelHold = async () => {
    if (!activeReservation) return;

    startTransition(async () => {
      setError('');
      const res = await cancelReservationAction(activeReservation.id);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.info('Piece released back to boutique inventory.');
        router.refresh();
      }
    });
  };

  // Trigger Checkout Options Modal for held items
  const triggerCheckout = () => {
    setCheckoutType('HELD');
    setIsCheckoutOpen(true);
  };

  // Checkout payment handler
  const handleCheckout = async (notes?: string) => {
    if (!activeReservation) return;
    startTransition(async () => {
      setError('');
      const res = await clientCheckoutAction({ reservationId: activeReservation.id, notes });
      if (res.error) {
        toast.error(res.error);
      } else if (res.useStandardCheckout) {
        // Standard Razorpay Checkout Modal
        const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
        if (!keyId) {
          toast.error('Razorpay Key ID is missing in environment variables.');
          return;
        }
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

              toast.success('Payment successful! Your order has been placed.');
              if (verifyData.orderId) {
                router.push(`/orders/${verifyData.orderId}/receipt`);
              } else {
                router.refresh();
              }
            } catch (verifyErr: any) {
              console.error(verifyErr);
              toast.error(`Verification Error: ${verifyErr.message}`);
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
          toast.error(`Payment failed: ${response.error.description}`);
        });
        rzp.open();
      } else if (res.paymentUrl) {
        window.open(res.paymentUrl, '_blank');
        toast.info('Checkout initiated! A payment page has opened in a new tab.');
        router.refresh();
      } else {
        toast.success('Checkout initiated successfully.');
        router.refresh();
      }
    });
  };

  // Trigger Buy Now Options Modal for direct purchase
  const triggerBuyNowDirect = () => {
    setCheckoutType('DIRECT');
    setIsCheckoutOpen(true);
  };

  // Direct checkout handler (Buy Now on available item)
  const handleBuyNowDirect = async (notes?: string) => {
    if (!activeCustomer) {
      toast.warning('Please sign in or register to complete your purchase.');
      return;
    }

    startTransition(async () => {
      setError('');
      // 1. Reserve first
      const reserveRes = await reserveProductAction(productId);
      if (reserveRes.error) {
        toast.error(reserveRes.error);
        return;
      }

      const reservationId = reserveRes.reservation?.id;
      if (!reservationId) {
        toast.error('Failed to place hold before checkout.');
        return;
      }

      // 2. Trigger checkout immediately
      const checkoutRes = await clientCheckoutAction({ reservationId, notes });
      if (checkoutRes.error) {
        toast.error(checkoutRes.error);
      } else if (checkoutRes.useStandardCheckout) {
        const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
        if (!keyId) {
          toast.error('Razorpay Key ID is missing in environment variables.');
          return;
        }
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

              toast.success('Payment successful! Your order has been placed.');
              if (verifyData.orderId) {
                router.push(`/orders/${verifyData.orderId}/receipt`);
              } else {
                router.refresh();
              }
            } catch (verifyErr: any) {
              console.error(verifyErr);
              toast.error(`Verification Error: ${verifyErr.message}`);
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
          toast.error(`Payment failed: ${response.error.description}`);
        });
        rzp.open();
      } else if (checkoutRes.paymentUrl) {
        window.open(checkoutRes.paymentUrl, '_blank');
        toast.info('Checkout initiated! A payment page has opened in a new tab.');
        router.refresh();
      } else {
        toast.success('Checkout initiated successfully.');
        router.refresh();
      }
    });
  };

  const isSold = inventoryStatus === 'SOLD' || (!isUnique && quantity <= 0);
  const isReserved = inventoryStatus === 'RESERVED';
  const isReservedByMe = isReserved && activeReservation && activeCustomer && activeReservation.customerId === activeCustomer.id;

  return (
    <div className="w-full font-body-md">
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />

      {isSold ? (
        <div className="bg-surface-container p-6 rounded-2xl border border-outline-variant/20 text-center">
          <p className="font-display text-on-surface text-base mb-2">This piece has found its home.</p>
          <p className="font-body-md text-on-surface-variant text-xs leading-relaxed">
            Each Jawhara design is a handcrafted masterpiece. Inquire to create a bespoke piece inspired by this design.
          </p>
          <a
            href={waUrl}
            target="_blank"
            className="mt-4 bg-primary text-on-primary font-label-md py-2.5 px-5 rounded-full uppercase tracking-wider text-[10px] inline-flex items-center gap-1.5 hover:opacity-95 transition-opacity cursor-pointer shadow-xs"
          >
            <span className="material-symbols-outlined text-[13px]">chat</span> Custom Inquiry
          </a>
        </div>
      ) : isReservedByMe ? (
        <div className="bg-success/5 border border-success/20 p-6 rounded-2xl space-y-4 shadow-xs text-center">
          <div className="text-success font-semibold flex items-center gap-1.5 text-xs justify-center uppercase tracking-wider">
            <span className="material-symbols-outlined text-sm">lock</span>
            You have placed this piece on hold ({timerText})
          </div>
          <p className="text-[11px] text-on-surface-variant leading-relaxed">
            Complete your checkout to purchase. If the timer expires, the hold will release back to general inventory.
          </p>
          <div className="flex flex-col gap-2.5">
            <button
              onClick={triggerCheckout}
              disabled={isPending}
              className="w-full bg-primary text-on-primary font-label-md py-3 px-5 rounded-full uppercase tracking-wider text-[10px] hover:opacity-95 transition-opacity flex justify-center items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50 font-semibold"
            >
              {isPending ? 'Processing...' : 'Buy Now (Complete Purchase)'}
            </button>
            <button
              onClick={handleCancelHold}
              disabled={isPending}
              className="w-full border border-outline/50 text-on-surface-variant font-label-md py-2.5 px-5 rounded-full uppercase tracking-wider text-[10px] hover:bg-surface-container-low transition-colors flex justify-center items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              Cancel Hold & Release Stock
            </button>
          </div>
        </div>
      ) : isReserved ? (
        <div className="bg-surface-container/50 p-6 rounded-2xl border border-outline-variant/20 text-center space-y-4">
          <div className="text-error font-semibold flex items-center justify-center gap-1.5 text-xs uppercase tracking-wider">
            <span className="material-symbols-outlined text-sm">schedule</span>
            On Hold (Reserved by another client: {timerText})
          </div>
          <p className="text-[11px] text-on-surface-variant leading-relaxed">
            This piece is currently on hold. Holds expire automatically after 20 minutes if unpaid. You can inquire about this piece via WhatsApp.
          </p>
          <a
            href={waUrl}
            target="_blank"
            className="w-full bg-primary text-on-primary font-label-md py-2.5 px-5 rounded-full uppercase tracking-wider text-[10px] inline-flex items-center justify-center gap-1.5 hover:opacity-95 transition-opacity cursor-pointer shadow-xs"
          >
            <span className="material-symbols-outlined text-[13px]">chat</span> Inquire on WhatsApp
          </a>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          <button
            onClick={triggerBuyNowDirect}
            disabled={isPending}
            className="w-full bg-primary text-on-primary font-label-md py-3 px-5 rounded-full uppercase tracking-wider text-[10px] hover:opacity-95 transition-opacity flex justify-center items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50 font-semibold"
          >
            <span className="material-symbols-outlined text-[13px]">shopping_cart</span>
            Buy Now
          </button>
          <button
            onClick={handleAddToCart}
            disabled={isPending}
            className={`w-full border font-label-md py-3 px-5 rounded-full uppercase tracking-wider text-[10px] transition-all flex justify-center items-center gap-1.5 cursor-pointer disabled:opacity-50 font-semibold ${
              addedToCart 
                ? 'bg-primary text-white border-primary shadow-xs' 
                : 'border-primary text-primary hover:bg-primary/5'
            }`}
          >
            <span className="material-symbols-outlined text-[13px]">
              {addedToCart ? 'check' : 'add_shopping_cart'}
            </span>
            {addedToCart ? 'Added to Cart ✓' : 'Add to Cart'}
          </button>
          <button
            onClick={handleReserve}
            disabled={isPending}
            className="w-full border border-primary text-primary font-label-md py-2.5 px-5 rounded-full uppercase tracking-wider text-[10px] hover:bg-primary/5 transition-colors flex justify-center items-center gap-1.5 cursor-pointer disabled:opacity-50 font-semibold"
          >
            <span className="material-symbols-outlined text-[13px]">lock</span>
            Reserve (20 min Hold)
          </button>
          <a
            href={waUrl}
            target="_blank"
            className="w-full border border-outline/40 text-on-surface-variant font-label-md py-2.5 px-5 rounded-full uppercase tracking-wider text-[10px] hover:bg-surface-container-low transition-colors flex justify-center items-center gap-1.5 cursor-pointer text-center justify-center"
          >
            <span className="material-symbols-outlined text-[13px]">chat</span> Ask on WhatsApp
          </a>
        </div>
      )}

      {/* Checkout Options Modal */}
      <CheckoutModal
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        showGuestFields={!activeCustomer}
        onConfirm={async (notes, guestInfo) => {
          if (guestInfo) {
            const regRes = await clientGuestRegisterAction(guestInfo);
            if (regRes.error) {
              toast.error(regRes.error);
              return;
            }
            if (regRes.customer) {
              setActiveCustomer(regRes.customer);
              if (checkoutType === 'DIRECT') {
                await handleBuyNowDirect(notes);
              } else {
                await handleCheckout(notes);
              }
            }
          } else {
            if (checkoutType === 'DIRECT') {
              await handleBuyNowDirect(notes);
            } else {
              await handleCheckout(notes);
            }
          }
          setIsCheckoutOpen(false);
        }}
        price={productPrice}
      />
    </div>
  );
}
