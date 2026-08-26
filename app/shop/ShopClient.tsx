'use client';

import React, { useState, useEffect, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { reserveProductAction } from './actions';

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
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState('');
  
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
    // Delete cookie by calling clear endpoint or simple fetch
    try {
      const response = await fetch('/shop/api/logout', { method: 'POST' });
      if (response.ok) {
        window.location.href = '/';
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Reservation handler
  const handleReserve = async (productId: string) => {
    if (!customer) {
      // Force log in
      router.push('/login');
      return;
    }

    if (!confirm('Place a temporary hold on this item for 30 minutes? Other users will see it as reserved.')) {
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
      {/* Admin preview banner */}
      {isAdmin && (
        <div className="bg-primary/10 border-b border-primary/20 py-2.5 px-4 text-center text-xs font-semibold text-primary flex items-center justify-center gap-2 relative z-50 animate-fade-in shrink-0">
          <span className="material-symbols-outlined text-[16px] text-primary">visibility</span>
          <span>Viewing boutique Lookbook in Customer Mode.</span>
          <Link href="/admin" className="underline hover:text-primary-hover font-bold ml-1 flex items-center gap-0.5">
            Back to Admin Panel
            <span className="material-symbols-outlined text-sm">arrow_forward</span>
          </Link>
        </div>
      )}

      {/* Rose Watermark background */}
      <div className="fixed inset-0 rose-watermark opacity-[0.02] z-0 pointer-events-none"></div>

      {/* Header bar */}
      <header className="w-full py-6 border-b border-outline-variant/20 bg-surface-container-lowest z-10 sticky top-0 shadow-sm">
        <div className="max-w-container-max mx-auto px-4 sm:px-6 md:px-8 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex flex-col items-center sm:items-start text-center sm:text-left">
            <span className="font-display font-semibold text-2xl tracking-widest uppercase text-primary">
              Jawhara
            </span>
            <span className="text-[9px] font-label-sm uppercase tracking-widest text-outline -mt-1">
              Where Every Thing Pretty Lives
            </span>
          </div>

          <div className="flex items-center gap-4">
            {customer ? (
              <div className="flex items-center gap-4">
                <div className="text-right hidden sm:block">
                  <p className="font-label-md text-xs text-outline uppercase tracking-wider">Welcome Client</p>
                  <p className="font-body-md text-sm text-on-surface font-semibold">{customer.name}</p>
                </div>
                <Link
                  href="/dashboard"
                  className="px-4 py-2 bg-primary-container text-on-primary-container text-xs font-label-md uppercase tracking-wider rounded-lg hover:opacity-90 transition-opacity flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[16px]">dashboard</span>
                  My Dashboard
                </Link>
                <button
                  onClick={handleLogout}
                  className="px-3 py-2 border border-outline text-on-surface-variant text-xs font-label-md uppercase tracking-wider rounded-lg hover:bg-surface-container-low transition-colors cursor-pointer"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <Link
                href="/login"
                className="px-5 py-2.5 bg-primary text-white text-xs font-label-md uppercase tracking-wider rounded-lg hover:opacity-90 transition-opacity flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[16px]">account_circle</span>
                Client Login
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-container-max w-full mx-auto px-4 sm:px-6 md:px-8 py-10 flex-grow relative z-10 space-y-8">
        
        {/* Banner Section */}
        <section className="text-center space-y-4 max-w-xl mx-auto py-6">
          <span className="material-symbols-outlined text-primary/10 text-7xl select-none" style={{ fontVariationSettings: "'FILL' 1" }}>
            local_florist
          </span>
          <h1 className="font-display text-4xl text-primary font-light">The Boutique Collection</h1>
          <p className="font-body-lg text-on-surface-variant leading-relaxed text-sm">
            Handcrafted ridas, decors, bedding accessories, and curated luxury pieces.
          </p>
        </section>

        {/* Filters and Controls Panel */}
        <section className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-4 sm:p-6 shadow-sm space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            
            {/* Search Input */}
            <div className="md:col-span-4 relative">
              <span className="material-symbols-outlined absolute left-3 top-3.5 text-outline text-lg">search</span>
              <input
                type="text"
                placeholder="Search name, code, colour..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent border-b border-outline-variant/50 focus:border-primary pl-10 pr-4 py-2.5 outline-none font-body-md text-sm outline-none transition-colors"
              />
            </div>

            {/* Category Select */}
            <div className="md:col-span-4 flex flex-col gap-1">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full bg-transparent border-b border-outline-variant/50 focus:border-primary py-2.5 outline-none font-body-md text-sm cursor-pointer transition-colors"
              >
                <option value="ALL">All Categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Availability Filter */}
            <div className="md:col-span-4 flex flex-col gap-1">
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full bg-transparent border-b border-outline-variant/50 focus:border-primary py-2.5 outline-none font-body-md text-sm cursor-pointer transition-colors"
              >
                <option value="ALL">All Availabilities</option>
                <option value="AVAILABLE">Available Now</option>
                <option value="RESERVED">On Hold / Reserved</option>
                <option value="SOLD">Sold Out</option>
              </select>
            </div>
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
            <div className="grid grid-cols-2 md:grid-cols-4 gap-gutter">
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
                    <div className="px-4 pb-4 flex items-center justify-between gap-2 border-t border-outline-variant/10 pt-3">
                      <span className="font-headline-sm text-primary text-sm font-semibold">
                        ₹{p.price.toLocaleString('en-IN')}
                      </span>
                      
                      {isAvailable ? (
                        <button
                          onClick={() => handleReserve(p.id)}
                          className="bg-primary text-white text-[10px] font-label-md uppercase tracking-wider px-3 py-1.5 rounded hover:opacity-90 cursor-pointer flex items-center gap-1 z-20"
                        >
                          <span className="material-symbols-outlined text-[12px]">lock</span>
                          Hold Piece
                        </button>
                      ) : isReserved ? (
                        <span className="text-[10px] font-label-md text-error italic uppercase tracking-wider flex items-center gap-1 font-semibold">
                          <span className="material-symbols-outlined text-[12px]">schedule</span>
                          On Hold ({timers[p.id] || 'Reserved'})
                        </span>
                      ) : (
                        <span className="text-[10px] font-label-md text-outline italic uppercase tracking-wider">
                          Unavailable
                        </span>
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
    </div>
  );
}
