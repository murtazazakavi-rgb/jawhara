'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function BottomNav({ isLoggedIn }: { isLoggedIn?: boolean }) {
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
    if (path === '/login') {
      return pathname === '/login' || (pathname === '/dashboard' && isLoggedIn);
    }
    return pathname === path;
  };

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 bg-surface-container-lowest/95 backdrop-blur-md border-t border-outline-variant/20 py-2 z-40 shadow-lg shrink-0 select-none">
      <div className="max-w-md mx-auto w-full flex justify-around items-center px-4">
        <Link 
          href="/" 
          className={`flex flex-col items-center gap-1 transition-colors cursor-pointer group ${
            isActive('/') ? 'text-primary' : 'text-on-surface-variant/75'
          }`}
        >
          <div className={`px-5 py-1 rounded-full transition-all duration-200 ${
            isActive('/') ? 'bg-primary/10 text-primary font-bold' : 'group-hover:bg-on-surface-variant/5'
          }`}>
            <span className="material-symbols-outlined text-[20px] font-medium block">storefront</span>
          </div>
          <span className={`text-[9px] font-label-md uppercase tracking-wider font-bold ${
            isActive('/') ? 'text-primary' : 'text-on-surface-variant/70'
          }`}>Shop</span>
        </Link>

        <Link 
          href="/dashboard" 
          className={`flex flex-col items-center gap-1 transition-colors cursor-pointer group ${
            isActive('/dashboard') ? 'text-primary' : 'text-on-surface-variant/75'
          }`}
        >
          <div className={`px-5 py-1 rounded-full transition-all duration-200 ${
            isActive('/dashboard') ? 'bg-primary/10 text-primary font-bold' : 'group-hover:bg-on-surface-variant/5'
          }`}>
            <span className="material-symbols-outlined text-[20px] font-medium block">schedule</span>
          </div>
          <span className={`text-[9px] font-label-md uppercase tracking-wider font-bold ${
            isActive('/dashboard') ? 'text-primary' : 'text-on-surface-variant/70'
          }`}>My Holds</span>
        </Link>

        <Link 
          href={isLoggedIn ? "/dashboard" : "/login"} 
          className={`flex flex-col items-center gap-1 transition-colors cursor-pointer group ${
            isActive('/login') ? 'text-primary' : 'text-on-surface-variant/75'
          }`}
        >
          <div className={`px-5 py-1 rounded-full transition-all duration-200 ${
            isActive('/login') ? 'bg-primary/10 text-primary font-bold' : 'group-hover:bg-on-surface-variant/5'
          }`}>
            <span className="material-symbols-outlined text-[20px] font-medium block">person</span>
          </div>
          <span className={`text-[9px] font-label-md uppercase tracking-wider font-bold ${
            isActive('/login') ? 'text-primary' : 'text-on-surface-variant/70'
          }`}>Account</span>
        </Link>
      </div>
    </div>
  );
}
