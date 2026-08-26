'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { logout } from '@/app/admin/login/actions';

interface AppShellProps {
  children: React.ReactNode;
  user: {
    name: string;
    email: string;
    role: string;
  } | null;
}

export default function AppShell({ children, user }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const handleLogout = async () => {
    await logout();
    router.push('/admin/login');
    router.refresh();
  };

  const navLinks = [
    { name: 'Dashboard', href: '/', icon: 'home' },
    { name: 'Products', href: '/products', icon: 'shopping_bag' },
    { name: 'Customers', href: '/customers', icon: 'group' },
    { name: 'WhatsApp', href: '/whatsapp', icon: 'chat' },
    { name: 'Orders', href: '/orders', icon: 'inventory_2' },
  ];

  if (user && user.role !== 'SALES') {
    navLinks.push({ name: 'Campaigns', href: '/campaigns', icon: 'campaign' });
    navLinks.push({ name: 'Automations', href: '/automations', icon: 'settings_suggest' });
  }

  return (
    <div className="bg-surface text-on-surface font-body-md min-h-screen pb-24 md:pb-0 relative flex flex-col">
      {/* Decorative Background Rose Watermark */}
      <div className="fixed inset-0 rose-watermark z-[-1] opacity-5"></div>

      {/* Top Header */}
      <header className="bg-surface border-b border-outline-variant/30 w-full py-4 z-40 sticky top-0">
        <div className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop flex justify-between items-center">
          
          {/* Logo Section */}
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-primary text-[28px]">
              save_as
            </span>
            <span className="font-display font-semibold text-headline-sm md:text-headline-md text-on-surface tracking-tight">
              Jawhara OS
            </span>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex gap-8 items-center">
            {navLinks.map((link) => {
              const isActive =
                link.href === '/'
                  ? pathname === '/'
                  : pathname.startsWith(link.href);
              return (
                <Link
                  key={link.name}
                  href={link.href}
                  className={`font-label-md text-label-md flex items-center gap-2 pb-1 border-b-2 transition-all ${
                    isActive
                      ? 'text-primary border-primary'
                      : 'text-on-surface-variant border-transparent hover:text-primary'
                  }`}
                >
                  <span className="material-symbols-outlined text-[20px]">
                    {link.icon}
                  </span>
                  {link.name}
                </Link>
              );
            })}
          </nav>

          {/* Right Header Area (Search, Notifications, Profile) */}
          <div className="flex items-center gap-4 text-on-surface-variant relative">
            <Link
              href="/shop"
              className="hover:text-primary transition-all flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-outline-variant/35 text-xs font-semibold font-label-md uppercase tracking-wider text-on-surface-variant hover:border-primary/30"
              title="Switch to customer Lookbook view"
            >
              <span className="material-symbols-outlined text-[18px]">shopping_basket</span>
              <span className="hidden sm:inline">Customer View</span>
            </Link>

            <button className="hover:text-primary transition-colors">
              <span className="material-symbols-outlined text-[24px]">search</span>
            </button>
            <button className="hover:text-primary transition-colors relative">
              <span className="material-symbols-outlined text-[24px]">notifications</span>
              <span className="absolute top-0 right-0 w-2 h-2 bg-primary-container rounded-full"></span>
            </button>

            {/* Profile Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className="w-8 h-8 rounded-full bg-secondary-container border border-outline-variant overflow-hidden flex items-center justify-center cursor-pointer focus:outline-none"
              >
                {user ? (
                  <div className="text-primary font-bold text-xs uppercase">
                    {user.name.slice(0, 2)}
                  </div>
                ) : (
                  <span className="material-symbols-outlined text-sm">person</span>
                )}
              </button>

              {showProfileMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-surface-container-lowest border border-outline-variant/50 rounded-lg shadow-md p-2 z-50 flex flex-col gap-1">
                  <div className="px-3 py-2 border-b border-outline-variant/20 mb-1">
                    <p className="font-label-md text-xs text-on-surface truncate">{user?.name}</p>
                    <p className="font-label-sm text-[10px] text-on-surface-variant truncate">{user?.email}</p>
                  </div>
                  <Link
                    href="/shop"
                    onClick={() => setShowProfileMenu(false)}
                    className="font-label-sm text-on-surface hover:bg-surface-container-low px-3 py-2 rounded flex items-center gap-2 border-b border-outline-variant/10 pb-2 mb-1"
                  >
                    <span className="material-symbols-outlined text-sm text-primary">shopping_basket</span>
                    Customer View
                  </Link>
                  <Link
                    href="/settings"
                    onClick={() => setShowProfileMenu(false)}
                    className="font-label-sm text-on-surface hover:bg-surface-container-low px-3 py-2 rounded flex items-center gap-2"
                  >
                    <span className="material-symbols-outlined text-sm">settings</span>
                    Settings
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="w-full text-left font-label-sm text-error hover:bg-error-container/15 px-3 py-2 rounded flex items-center gap-2"
                  >
                    <span className="material-symbols-outlined text-sm">logout</span>
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>

        </div>
      </header>

      {/* Main Canvas */}
      <main className="flex-grow w-full max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop py-8 md:py-12">
        {children}
      </main>

      {/* Mobile Bottom Navigation (Visible only on mobile) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-surface-container-lowest border-t border-outline-variant/30 flex justify-around py-2.5 z-40 shadow-lg px-2">
        {navLinks.map((link) => {
          const isActive =
            link.href === '/'
              ? pathname === '/'
              : pathname.startsWith(link.href);
          return (
            <Link
              key={link.name}
              href={link.href}
              className={`flex flex-col items-center gap-0.5 text-[9px] font-label-sm min-w-0 flex-1 ${
                isActive ? 'text-primary font-semibold' : 'text-on-surface-variant hover:text-primary'
              }`}
            >
              <span className="material-symbols-outlined text-[20px] transition-transform active:scale-95">
                {link.icon}
              </span>
              <span className="hidden sm:inline truncate max-w-[55px] text-center w-full">{link.name}</span>
            </Link>
          );
        })}
        <Link
          href="/settings"
          className={`flex flex-col items-center gap-0.5 text-[9px] font-label-sm min-w-0 flex-1 ${
            pathname.startsWith('/settings') ? 'text-primary font-semibold' : 'text-on-surface-variant hover:text-primary'
          }`}
        >
          <span className="material-symbols-outlined text-[20px] transition-transform active:scale-95">settings</span>
          <span className="hidden sm:inline truncate max-w-[55px] text-center w-full">Settings</span>
        </Link>
      </nav>
    </div>
  );
}
