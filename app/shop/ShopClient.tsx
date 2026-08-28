'use client';

import React, { useState, useEffect, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { reserveProductAction, clientCheckoutAction, clientCartCheckoutAction, clientGuestRegisterAction } from './actions';
import Script from 'next/script';
import CheckoutModal from '@/components/CheckoutModal';

interface Product {
  id: string;
  productCode: string;
  name: string;
  slug: string;
  price: number;
  shortDesc: string | null;
  inventoryStatus: string;
  publishStatus: string;
  isUnique: boolean;
  quantity: number;
  primaryColour: string | null;
  category: { id: string; name: string };
  images: { url: string; isPrimary: boolean }[];
  activeReservation?: { expiresAt: string | null } | null;
}

interface Customer {
  id: string;
  name: string;
  mobile: string | null;
}

interface ShopClientProps {
  initialProducts: Product[];
  categories: { id: string; name: string }[];
  customer: Customer | null;
  isAdmin?: boolean;
}

export default function ShopClient({
  initialProducts,
  categories,
  customer,
  isAdmin = false,
}: ShopClientProps) {
  const router = useRouter();
  const [activeCustomer, setActiveCustomer] = useState(customer);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState('');
  
  // Checkout Modal State
  const [checkoutProduct, setCheckoutProduct] = useState<Product | null>(null);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [checkoutMode, setCheckoutMode] = useState<'DIRECT' | 'CART'>('DIRECT');
  
  // Shopping Cart States
  const [cart, setCart] = useState<any[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCartCheckingOut, setIsCartCheckingOut] = useState(false);

  useEffect(() => {
    const loadCart = () => {
      try {
        const stored = localStorage.getItem('jawhara_cart');
        if (stored) {
          setCart(JSON.parse(stored));
        }
      } catch (e) {
        console.error(e);
      }
    };
    
    loadCart();
    
    window.addEventListener('jawhara_cart_updated', loadCart);
    return () => {
      window.removeEventListener('jawhara_cart_updated', loadCart);
    };
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('checkoutCart') === 'true' && activeCustomer) {
        setIsCartOpen(true);
        router.replace('/', { scroll: false });
      }
    }
  }, [activeCustomer, router]);

  const handleAddToCart = (product: Product) => {
    try {
      const stored = localStorage.getItem('jawhara_cart');
      const currentCart = stored ? JSON.parse(stored) : [];
      const existing = currentCart.find((item: any) => item.id === product.id);

      if (existing) {
        if (product.isUnique) {
          alert('This unique item is already in your cart.');
          return;
        }
        if (existing.quantity >= product.quantity) {
          alert(`You have added the maximum available quantity (${product.quantity}) for this item.`);
          return;
        }
        existing.quantity += 1;
        alert('Increased item quantity in cart!');
      } else {
        currentCart.push({
          id: product.id,
          productCode: product.productCode,
          name: product.name,
          price: product.price,
          slug: product.slug,
          image: product.images[0]?.url || null,
          isUnique: product.isUnique,
          maxQuantity: product.quantity,
          quantity: 1,
        });
        alert('Item added to cart!');
      }
      localStorage.setItem('jawhara_cart', JSON.stringify(currentCart));
      setCart(currentCart);
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpdateCartQuantity = (productId: string, newQty: number) => {
    const updated = cart.map(item => {
      if (item.id === productId) {
        const qty = Math.max(1, Math.min(newQty, item.maxQuantity));
        return { ...item, quantity: qty };
      }
      return item;
    });
    localStorage.setItem('jawhara_cart', JSON.stringify(updated));
    setCart(updated);
  };

  const handleRemoveFromCart = (productId: string) => {
    const updated = cart.filter(item => item.id !== productId);
    localStorage.setItem('jawhara_cart', JSON.stringify(updated));
    setCart(updated);
  };

  const handleCartCheckout = async (notes?: string) => {
    if (!activeCustomer && !notes) {
      setCheckoutMode('CART');
      setCheckoutProduct(null);
      setIsCheckoutOpen(true);
      setIsCartOpen(false); // Close cart drawer so checkout modal is visible
      return;
    }

    if (cart.length === 0) return;
    
    setIsCartOpen(false); // Close cart drawer when starting payment process
    setIsCartCheckingOut(true);
    try {
      const items = cart.map(item => ({ productId: item.id, quantity: item.quantity }));
      const checkoutRes = await clientCartCheckoutAction({ items, notes });
      
      if (checkoutRes.error) {
        alert(checkoutRes.error);
        setIsCartCheckingOut(false);
      } else if (checkoutRes.useStandardCheckout) {
        const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
        if (!keyId) {
          alert('Razorpay Key ID is missing in environment variables.');
          setIsCartCheckingOut(false);
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

              // Clear cart on success
              localStorage.removeItem('jawhara_cart');
              setCart([]);
              alert('Payment successful! Your order has been placed and is being processed.');
              if (verifyData.orderId) {
                router.push(`/orders/${verifyData.orderId}/receipt`);
              } else {
                router.refresh();
              }
            } catch (verifyErr: any) {
              console.error(verifyErr);
              alert(`Verification Error: ${verifyErr.message}`);
            } finally {
              setIsCartCheckingOut(false);
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
          modal: {
            ondismiss: function () {
              setIsCartCheckingOut(false);
            }
          }
        };

        const rzp = new (window as any).Razorpay(options);
        rzp.on('payment.failed', function (response: any) {
          alert(`Payment failed: ${response.error.description}`);
          setIsCartCheckingOut(false);
        });
        rzp.open();
      } else if (checkoutRes.paymentUrl) {
        window.open(checkoutRes.paymentUrl, '_blank');
        localStorage.removeItem('jawhara_cart');
        setCart([]);
        alert('Checkout initiated! A payment page has opened in a new tab. Once payment succeeds, your order status will be updated on your dashboard.');
        router.refresh();
        setIsCartCheckingOut(false);
      } else {
        localStorage.removeItem('jawhara_cart');
        setCart([]);
        alert('Checkout initiated successfully.');
        router.refresh();
        setIsCartCheckingOut(false);
      }
    } catch (err) {
      console.error(err);
      alert('Failed to initiate checkout.');
      setIsCartCheckingOut(false);
    }
  };
  
  // Real-time reservation countdown timers
  const [timers, setTimers] = useState<Record<string, string>>({});
  const [expiredHolds, setExpiredHolds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let needsRefresh = false;
    const update = () => {
      const now = Date.now();
      const nextTimers: Record<string, string> = {};
      
      initialProducts.forEach(p => {
        if (p.inventoryStatus === 'RESERVED' && p.activeReservation?.expiresAt) {
          const diff = new Date(p.activeReservation.expiresAt).getTime() - now;
          if (diff <= 0) {
            nextTimers[p.id] = 'Expired';
            if (!expiredHolds[p.id]) {
              needsRefresh = true;
              setExpiredHolds(prev => ({ ...prev, [p.id]: true }));
            }
          } else {
            const mins = Math.floor(diff / 60000);
            const secs = Math.floor((diff % 60000) / 1000);
            nextTimers[p.id] = `${mins}m ${secs}s`;
          }
        }
      });
      
      setTimers(nextTimers);
      if (needsRefresh) {
        router.refresh();
      }
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [initialProducts, expiredHolds, router]);
  
  // State filters
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Logout handler
  const handleLogout = async () => {
    try {
      const response = await fetch('/shop/api/logout', { method: 'POST' });
      if (response.ok) {
        setActiveCustomer(null);
        window.location.href = '/';
      }
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  // Reservation handler
  const handleReserve = async (productId: string) => {
    if (!customer) {
      alert('Please sign in or register to place this item on hold.');
      router.push('/login');
      return;
    }

    if (!confirm('Place a temporary hold on this item for 20 minutes? Other users will see it as reserved.')) {
      return;
    }

    startTransition(async () => {
      setError('');
      const res = await reserveProductAction(productId);
      if (res.error) {
        setError(res.error);
        alert(res.error);
      } else {
        alert('Item placed on hold successfully! Go to My Dashboard to track the timer.');
        router.refresh();
      }
    });
  };

  // Trigger Buy Now and open Checkout Options Modal
  const triggerBuyNow = (product: Product) => {
    setCheckoutMode('DIRECT');
    setCheckoutProduct(product);
    setIsCheckoutOpen(true);
  };

  // Direct Buy Now handler from the catalogue page
  const handleBuyNow = async (productId: string, notes?: string) => {
    if (!activeCustomer) {
      alert('Please sign in or register to complete your purchase.');
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
      const checkoutRes = await clientCheckoutAction({ reservationId, notes });
      if (checkoutRes.error) {
        alert(checkoutRes.error);
      } else if (checkoutRes.useStandardCheckout) {
        const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
        if (!keyId) {
          alert('Razorpay Key ID is missing in environment variables.');
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

              alert('Payment successful! Your order has been placed and is being processed.');
              if (verifyData.orderId) {
                router.push(`/orders/${verifyData.orderId}/receipt`);
              } else {
                router.refresh();
              }
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

  // Filtering Logic
  const filteredProducts = initialProducts.filter((product) => {
    const matchesCategory = selectedCategory === 'ALL' || product.category.id === selectedCategory;
    
    let matchesStatus = true;
    if (selectedStatus === 'AVAILABLE') {
      matchesStatus = product.inventoryStatus === 'AVAILABLE' && product.quantity > 0;
    } else if (selectedStatus === 'RESERVED') {
      matchesStatus = product.inventoryStatus === 'RESERVED';
    } else if (selectedStatus === 'SOLD') {
      matchesStatus = product.inventoryStatus === 'SOLD';
    }

    const matchesSearch = 
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.productCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (product.primaryColour && product.primaryColour.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesCategory && matchesStatus && matchesSearch;
  });

  return (
    <div className="bg-surface text-on-surface min-h-screen font-body-md flex flex-col relative overflow-x-hidden">
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />

      {/* Rose Watermark background */}
      <div className="fixed inset-0 rose-watermark opacity-[0.02] z-0 pointer-events-none"></div>

      {/* Header bar */}
      <header className="w-full py-6 border-b border-outline-variant/20 bg-surface-container-lowest z-10 sticky top-0 shadow-sm">
        <div className="max-w-container-max mx-auto px-5 sm:px-6 md:px-8 flex flex-col sm:flex-row justify-between items-center gap-4">
          <Link href="/" className="flex flex-col items-center sm:items-start text-center sm:text-left group cursor-pointer">
            <span className="font-display font-semibold text-2xl tracking-widest uppercase text-primary group-hover:opacity-80 transition-opacity">
              Jawhara
            </span>
            <span className="text-[9px] font-label-sm uppercase tracking-widest text-outline -mt-1">
              Where Every Thing Pretty Lives
            </span>
          </Link>

          <div className="flex items-center gap-4">
            {/* Cart Button */}
            <button
              onClick={() => setIsCartOpen(true)}
              className="relative p-2 text-primary hover:opacity-85 transition-opacity cursor-pointer flex items-center justify-center border border-outline-variant/30 rounded-full"
            >
              <span className="material-symbols-outlined text-[20px]">shopping_bag</span>
              {cart.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-error text-white font-bold text-[9px] w-4 h-4 rounded-full flex items-center justify-center animate-fade-in shadow-sm">
                  {cart.length}
                </span>
              )}
            </button>

            {activeCustomer ? (
              <div className="flex items-center gap-3 border-l border-outline-variant/30 pl-4">
                <button
                  onClick={handleLogout}
                  className="text-[10px] font-label-md uppercase tracking-wider text-error hover:underline flex items-center gap-1.5 font-semibold cursor-pointer"
                >
                  <span className="material-symbols-outlined text-xs">logout</span>
                  Sign Out
                </button>
              </div>
            ) : (
              <Link
                href="/login"
                className="px-5 py-2 bg-primary text-white text-[10px] font-label-md uppercase tracking-wider rounded-full hover:opacity-90 transition-opacity flex items-center gap-1.5 shadow-sm font-semibold"
              >
                <span className="material-symbols-outlined text-xs">account_circle</span>
                Client Login
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-container-max w-full mx-auto px-5 sm:px-6 md:px-8 py-10 flex-grow relative z-10 space-y-8">
        
        {/* Banner Section */}
        <section className="text-center space-y-1 max-w-xl mx-auto py-2">
          <h1 className="font-display text-2xl text-primary font-medium tracking-wide">The Boutique Collection</h1>
          <p className="font-body-sm text-on-surface-variant text-xs max-w-md mx-auto">
            Handcrafted ridas, decors, bedding accessories, and curated luxury pieces.
          </p>
        </section>

        {/* New Arrivals Section (Horizontal Scroll) */}
        {initialProducts.filter((p) => p.inventoryStatus === 'AVAILABLE').length > 0 && (
          <section className="space-y-3 animate-fade-in">
            <div className="flex justify-between items-baseline px-1">
              <h2 className="font-display text-xs text-primary font-bold uppercase tracking-wider">New Arrivals</h2>
              <span className="text-[9px] font-label-md uppercase tracking-wider text-outline select-none">Swipe to explore →</span>
            </div>
            
            <div className="flex gap-4 overflow-x-auto pb-4 pt-1 snap-x scrollbar-none -mx-5 px-5 sm:mx-0 sm:px-0">
              {initialProducts
                .filter((p) => p.inventoryStatus === 'AVAILABLE')
                .slice(0, 6)
                .map((p) => {
                  const mainImg = p.images[0]?.url || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200';
                  return (
                    <div 
                      key={p.id}
                      className="snap-start w-[140px] sm:w-[160px] shrink-0 bg-surface-container-lowest border border-outline-variant/10 rounded-lg overflow-hidden flex flex-col shadow-sm relative hover:shadow-md transition-shadow"
                    >
                      {/* New Badge */}
                      <span className="absolute top-2 left-2 z-10 text-[8px] font-label-sm uppercase tracking-wide px-1.5 py-0.5 bg-primary/10 text-primary rounded font-semibold backdrop-blur-xs">
                        New
                      </span>
                      
                      <Link href={`/p/${p.slug}`} className="flex flex-col flex-grow">
                        <div className="aspect-[3/4] bg-surface-container-low overflow-hidden relative">
                          <img src={mainImg} alt={p.name} className="w-full h-full object-cover" />
                        </div>
                        <div className="p-2.5 flex-grow flex flex-col justify-between space-y-1">
                          <div className="space-y-0.5">
                            <span className="text-[8px] font-mono text-outline block">{p.productCode}</span>
                            <h3 className="font-label-md text-xs text-on-surface font-semibold line-clamp-1 hover:text-primary transition-colors">
                              {p.name}
                            </h3>
                          </div>
                          <span className="font-bold text-xs text-primary">₹{p.price.toLocaleString('en-IN')}</span>
                        </div>
                      </Link>
                    </div>
                  );
                })}
            </div>
          </section>
        )}

        {/* Search & Category Chips Panel */}
        <section className="space-y-3.5 pt-2 border-t border-outline-variant/15">
          {/* Search Bar */}
          <div className="relative max-w-md mx-auto">
            <span className="material-symbols-outlined absolute left-3.5 top-2 text-outline text-lg">search</span>
            <input
              type="text"
              placeholder="Search name, code, colour..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-full pl-10 pr-10 py-1.5 outline-none font-body-md text-xs transition-all focus:border-primary focus:shadow-sm"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-2 text-outline-variant hover:text-outline cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            )}
          </div>

          {/* Categories Horizontal Scrolling List */}
          <div className="flex gap-2 overflow-x-auto pb-2 pt-1 scrollbar-none -mx-5 px-5 sm:mx-0 sm:px-0">
            <button
              onClick={() => setSelectedCategory('ALL')}
              className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-label-md transition-all cursor-pointer border ${
                selectedCategory === 'ALL'
                  ? 'bg-primary border-primary text-white shadow-sm font-semibold'
                  : 'bg-surface-container-lowest border-outline-variant/30 text-on-surface-variant hover:bg-surface-container-low'
              }`}
            >
              All Items
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-label-md transition-all cursor-pointer border ${
                  selectedCategory === cat.id
                    ? 'bg-primary border-primary text-white shadow-sm font-semibold'
                    : 'bg-surface-container-lowest border-outline-variant/30 text-on-surface-variant hover:bg-surface-container-low'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>

          {/* Quick Availability Filters (Horizontal Row) */}
          <div className="flex justify-center gap-1.5 text-[9px] uppercase tracking-wider font-semibold">
            {[
              { label: 'All Pieces', value: 'ALL' },
              { label: 'Available Now', value: 'AVAILABLE' },
              { label: 'On Hold', value: 'RESERVED' },
              { label: 'Sold', value: 'SOLD' }
            ].map((opt) => (
              <button
                key={opt.value}
                onClick={() => setSelectedStatus(opt.value)}
                className={`px-3 py-1 rounded-full transition-colors cursor-pointer border ${
                  selectedStatus === opt.value
                    ? 'bg-primary/10 text-primary border-primary/20 font-bold'
                    : 'bg-transparent text-outline border-transparent hover:bg-surface-container-low'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </section>

        {/* Product Catalogue Grid */}
        <section>
          {filteredProducts.length === 0 ? (
            <div className="text-center py-20 bg-surface-container-lowest border border-outline-variant/30 rounded-xl">
               <span className="material-symbols-outlined text-outline/30 text-6xl mb-4">folder_open</span>
              <h3 className="font-headline-md text-lg text-on-surface mb-1">No pieces found matching filters.</h3>
              <p className="font-body-md text-xs text-on-surface-variant">Try adjusting your filters or search terms.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
              {filteredProducts.map((p) => {
                const mainImg = p.images[0]?.url || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=300';
                
                // Badging rules
                const isSold = p.inventoryStatus === 'SOLD';
                const isReserved = p.inventoryStatus === 'RESERVED';
                const isAvailable = p.inventoryStatus === 'AVAILABLE' && p.quantity > 0;

                return (
                  <div 
                    key={p.id}
                    className="group bg-surface-container-lowest border border-outline-variant/20 rounded-xl overflow-hidden flex flex-col shadow-sm hover:shadow-md transition-shadow relative"
                  >
                    
                    {/* Status Badge */}
                    <div className="absolute top-3 left-3 z-10 flex flex-col gap-1">
                      <span className="text-[9px] font-label-md uppercase tracking-wider px-2 py-0.5 bg-surface-container-lowest/80 border border-outline-variant/30 text-outline rounded font-semibold backdrop-blur-sm">
                        {p.category.name}
                      </span>
                      
                      {isReserved && (
                        <span className="text-[9px] font-label-sm uppercase tracking-wider px-2 py-0.5 bg-error/15 text-error border border-error/20 rounded font-bold backdrop-blur-sm flex items-center gap-1">
                          <span className="material-symbols-outlined text-[10px]">schedule</span>
                          Hold: {timers[p.id] || 'Reserved'}
                        </span>
                      )}
                      
                      {isSold && (
                        <span className="text-[9px] font-label-sm uppercase tracking-wider px-2 py-0.5 bg-outline-variant/30 text-outline border border-outline-variant/30 rounded font-bold backdrop-blur-sm">
                          Sold Out
                        </span>
                      )}
                      
                      {isAvailable && (
                        <span className="text-[9px] font-label-sm uppercase tracking-wider px-2 py-0.5 bg-success/15 text-success border border-success/20 rounded font-bold backdrop-blur-sm">
                          Available
                        </span>
                      )}
                    </div>

                    <Link href={`/p/${p.slug}`} className="flex flex-col flex-grow cursor-pointer group/link">
                      {/* Image Frame */}
                      <div className="aspect-[3/4] bg-surface-container-low overflow-hidden relative shrink-0">
                        <img 
                          src={mainImg} 
                          alt={p.name} 
                          className="w-full h-full object-cover transition-transform duration-500 group-hover/link:scale-105"
                        />
                      </div>

                      {/* Meta info */}
                      <div className="p-4 flex-grow flex flex-col justify-between">
                        <div className="space-y-1.5">
                          <span className="text-[10px] font-mono text-outline block">{p.productCode}</span>
                          <h3 className="font-label-md text-sm text-on-surface font-semibold group-hover/link:text-primary transition-colors line-clamp-1">
                            {p.name}
                          </h3>
                          {p.shortDesc && (
                            <p className="font-body-sm text-xs text-on-surface-variant line-clamp-2 leading-relaxed">
                              {p.shortDesc}
                            </p>
                          )}
                        </div>
                      </div>
                    </Link>

                    {/* Action bar */}
                    <div className="px-4 pb-4 flex flex-col gap-2.5 border-t border-outline-variant/10 pt-3">
                      <div className="flex justify-between items-center px-0.5 mb-0.5">
                        <span className="text-[10px] font-label-sm text-outline uppercase tracking-wider">Price</span>
                        <span className="font-headline-sm text-primary text-sm font-bold">
                          ₹{p.price.toLocaleString('en-IN')}
                        </span>
                      </div>
                      
                      {isAvailable ? (
                        <div className="flex flex-col gap-2 w-full">
                          <div className="flex gap-2 w-full">
                            <button
                              onClick={() => triggerBuyNow(p)}
                              className="flex-[2] bg-primary text-white text-[10px] font-label-md uppercase tracking-wider py-2 rounded-full hover:opacity-90 cursor-pointer flex items-center justify-center gap-1.5 z-20 transition-all font-semibold shadow-xs"
                            >
                              Buy Now
                            </button>
                            <button
                              onClick={() => handleAddToCart(p)}
                              className="w-9 h-9 shrink-0 border border-primary/60 text-primary rounded-full hover:bg-primary/5 cursor-pointer flex items-center justify-center z-20 transition-all font-semibold"
                              title="Add to Cart"
                            >
                              <span className="material-symbols-outlined text-[16px]">add_shopping_cart</span>
                            </button>
                          </div>
                          <button
                            onClick={() => handleReserve(p.id)}
                            className="w-full border border-outline/35 text-on-surface-variant text-[10px] font-label-md uppercase tracking-wider py-2 rounded-full hover:bg-surface-container-low cursor-pointer flex items-center justify-center gap-1.5 z-20 transition-all"
                          >
                            <span className="material-symbols-outlined text-[14px]">lock</span>
                            Hold (20m)
                          </button>
                        </div>
                      ) : isReserved ? (
                        <div className="text-center w-full py-2 bg-error/5 border border-error/15 rounded-full">
                          <span className="text-[10px] font-label-md text-error uppercase tracking-wider flex items-center justify-center gap-1.5 font-semibold">
                            <span className="material-symbols-outlined text-[13px]">schedule</span>
                            On Hold ({timers[p.id] || 'Reserved'})
                          </span>
                        </div>
                      ) : (
                        <div className="text-center w-full py-2 bg-surface-container-low border border-outline-variant/20 rounded-full">
                          <span className="text-[10px] font-label-md text-outline uppercase tracking-wider font-semibold">
                            Sold Out
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>

      {/* Footer */}
      <footer className="w-full py-8 border-t border-outline-variant/20 bg-surface-container-lowest mt-16 text-center">
        <p className="text-[10px] font-mono text-outline">
          © {new Date().getFullYear()} Jawhara - Dynamic Lookbook by MJZ
        </p>
      </footer>

      {/* Checkout Options Modal */}
      <CheckoutModal
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        showGuestFields={!activeCustomer}
        onConfirm={async (notes, guestInfo) => {
          if (guestInfo) {
            // Register guest customer first
            const regRes = await clientGuestRegisterAction(guestInfo);
            if (regRes.error) {
              alert(regRes.error);
              return;
            }
            if (regRes.customer) {
              setActiveCustomer(regRes.customer);
              // Now that they are registered and logged in, trigger checkout
              if (checkoutMode === 'DIRECT' && checkoutProduct) {
                await handleBuyNow(checkoutProduct.id, notes);
              } else if (checkoutMode === 'CART') {
                await handleCartCheckout(notes);
              }
            }
          } else {
            if (checkoutMode === 'DIRECT' && checkoutProduct) {
              await handleBuyNow(checkoutProduct.id, notes);
            } else if (checkoutMode === 'CART') {
              await handleCartCheckout(notes);
            }
          }
          setIsCheckoutOpen(false);
        }}
        price={checkoutMode === 'DIRECT' ? (checkoutProduct?.price || 0) : cart.reduce((sum, item) => sum + item.price * item.quantity, 0)}
      />

      {/* Shopping Cart Drawer Sidebar */}
      {isCartOpen && (
        <div className="fixed inset-0 z-[100] flex justify-end">
          {/* Backdrop */}
          <div
            onClick={() => setIsCartOpen(false)}
            className="absolute inset-0 bg-black/45 backdrop-blur-xs cursor-pointer transition-opacity"
          ></div>

          {/* Drawer Body */}
          <div className="relative w-full max-w-md bg-surface-container-lowest h-full shadow-2xl flex flex-col z-10 border-l border-outline-variant/30 animate-slide-in-right">
            {/* Drawer Header */}
            <div className="p-5 border-b border-outline-variant/20 flex justify-between items-center bg-surface-container-low">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-xl">shopping_bag</span>
                <h3 className="font-display font-semibold text-lg text-primary uppercase tracking-wider">My Shopping Cart</h3>
              </div>
              <button
                onClick={() => setIsCartOpen(false)}
                className="text-on-surface-variant hover:text-primary transition-colors cursor-pointer flex items-center justify-center p-1 rounded-full border border-outline-variant/20"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            {/* Cart Items List */}
            <div className="flex-grow overflow-y-auto p-5 space-y-4">
              {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-3">
                  <span className="material-symbols-outlined text-outline/30 text-5xl">shopping_cart_checkout</span>
                  <p className="font-body-md text-on-surface-variant italic text-sm">Your cart is empty.</p>
                  <button
                    onClick={() => setIsCartOpen(false)}
                    className="bg-primary text-white text-xs font-label-md uppercase tracking-wider px-4 py-2 rounded-lg hover:opacity-90"
                  >
                    Start Adding Pieces
                  </button>
                </div>
              ) : (
                cart.map((item) => {
                  const img = item.image || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150';
                  return (
                    <div
                      key={item.id}
                      className="flex gap-4 p-3 bg-surface-container-low border border-outline-variant/20 rounded-xl relative overflow-hidden"
                    >
                      <Link
                        href={`/p/${item.slug}`}
                        onClick={() => setIsCartOpen(false)}
                        className="w-16 h-20 bg-surface-container-low rounded-lg overflow-hidden shrink-0 block hover:opacity-90"
                      >
                        <img src={img} alt={item.name} className="w-full h-full object-cover" />
                      </Link>

                      <div className="flex-grow flex flex-col justify-between">
                        <div>
                          <div className="flex justify-between items-start gap-2">
                            <Link
                              href={`/p/${item.slug}`}
                              onClick={() => setIsCartOpen(false)}
                              className="hover:underline hover:text-primary"
                            >
                              <h4 className="font-label-md text-xs text-on-surface font-semibold line-clamp-1">
                                {item.name}
                              </h4>
                            </Link>
                            <span className="font-mono text-[9px] text-outline shrink-0">{item.productCode}</span>
                          </div>
                          <p className="font-headline-sm text-primary text-xs font-semibold mt-1">
                            ₹{item.price.toLocaleString('en-IN')}
                          </p>
                        </div>

                        <div className="flex justify-between items-center mt-2 pt-2 border-t border-outline-variant/10">
                          {/* Quantity Selector */}
                          {!item.isUnique && item.maxQuantity > 1 ? (
                            <div className="flex items-center gap-2 bg-surface-container border border-outline-variant/30 rounded-full px-2 py-0.5">
                              <button
                                onClick={() => handleUpdateCartQuantity(item.id, item.quantity - 1)}
                                disabled={item.quantity <= 1}
                                className="text-xs font-bold text-on-surface-variant hover:text-primary disabled:opacity-40 cursor-pointer w-4 h-4 flex items-center justify-center"
                              >
                                -
                              </button>
                              <span className="text-[11px] font-semibold font-mono w-4 text-center">{item.quantity}</span>
                              <button
                                onClick={() => handleUpdateCartQuantity(item.id, item.quantity + 1)}
                                disabled={item.quantity >= item.maxQuantity}
                                className="text-xs font-bold text-on-surface-variant hover:text-primary disabled:opacity-40 cursor-pointer w-4 h-4 flex items-center justify-center"
                              >
                                +
                              </button>
                            </div>
                          ) : (
                            <span className="text-[10px] text-outline uppercase font-label-sm">Qty: 1</span>
                          )}

                          <button
                            onClick={() => handleRemoveFromCart(item.id)}
                            className="text-[9px] font-label-md text-error hover:underline uppercase tracking-wider cursor-pointer"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Cart Footer */}
            {cart.length > 0 && (
              <div className="p-5 border-t border-outline-variant/20 bg-surface-container-low space-y-4">
                <div className="flex justify-between items-center">
                  <span className="font-label-md text-xs text-outline uppercase tracking-wider">Subtotal:</span>
                  <span className="font-headline-lg text-primary text-base font-bold">
                    ₹{cart.reduce((sum, item) => sum + item.price * item.quantity, 0).toLocaleString('en-IN')}
                  </span>
                </div>
                
                <p className="text-[10px] text-on-surface-variant leading-relaxed italic">
                  Note: Pieces in the cart are not held until checkout is initiated. Items marked "On Hold" or "Sold" in inventory cannot be checked out.
                </p>

                <button
                  onClick={() => handleCartCheckout()}
                  disabled={isCartCheckingOut}
                  className="w-full bg-primary text-white font-label-md py-3 px-5 rounded-full uppercase tracking-wider text-[10px] hover:opacity-95 transition-opacity flex justify-center items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50 font-semibold"
                >
                  {isCartCheckingOut ? (
                    <>
                      <span className="animate-spin rounded-full h-3 w-3 border-2 border-white border-t-transparent"></span>
                      Initiating Payment...
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[13px]">payments</span>
                      Checkout Cart (₹{cart.reduce((sum, item) => sum + item.price * item.quantity, 0).toLocaleString('en-IN')})
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
