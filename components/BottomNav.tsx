'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function BottomNav() {
  const pathname = usePathname();

  // Define routes where bottom navigation should be visible
  const visibleRoutes = ['/', '/shop', '/dashboard'];
  const isProductRoute = pathname.startsWith('/p/');
  
  const shouldShow = visibleRoutes.includes(pathname) || isProductRoute;

  if (!shouldShow) return null;

  const isActive = (path: string) => {
    if (path === '/') {
      return pathname === '/' || pathname === '/shop' || isProductRoute;
    }
    return pathname === path;
  };

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 bg-surface-container-lowest/90 backdrop-blur-md border-t border-outline-variant/30 py-2.5 px-6 flex justify-between items-center z-40 shadow-lg shrink-0">
      <Link 
        href="/" 
        className={`flex flex-col items-center gap-1 transition-colors cursor-pointer ${
          isActive('/') ? 'text-primary' : 'text-on-surface-variant'
        }`}
      >
        <span className="material-symbols-outlined text-[22px] font-medium">storefront</span>
        <span className="text-[9px] font-label-md uppercase tracking-wider font-semibold">Shop</span>
      </Link>

      <Link 
        href="/dashboard" 
        className={`flex flex-col items-center gap-1 transition-colors cursor-pointer ${
          isActive('/dashboard') ? 'text-primary' : 'text-on-surface-variant'
        }`}
      >
        <span className="material-symbols-outlined text-[22px] font-medium">schedule</span>
        <span className="text-[9px] font-label-md uppercase tracking-wider font-semibold">My Holds</span>
      </Link>

      <a 
        href="https://wa.me/919876543210" 
        target="_blank"
        rel="noopener noreferrer"
        className="flex flex-col items-center gap-1 text-on-surface-variant hover:text-primary transition-colors cursor-pointer"
      >
        <span className="material-symbols-outlined text-[22px] font-medium font-filled text-success">chat</span>
        <span className="text-[9px] font-label-md uppercase tracking-wider font-semibold">WhatsApp</span>
      </a>

      <Link 
        href="/login" 
        className={`flex flex-col items-center gap-1 transition-colors cursor-pointer ${
          isActive('/login') ? 'text-primary' : 'text-on-surface-variant'
        }`}
      >
        <span className="material-symbols-outlined text-[22px] font-medium">person</span>
        <span className="text-[9px] font-label-md uppercase tracking-wider font-semibold">Account</span>
      </Link>
    </div>
  );
}
