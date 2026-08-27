'use client';

import React, { useState, useEffect, useRef } from 'react';
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
  const [toasts, setToasts] = useState<{ id: string; title: string; message: string; type: 'order' | 'hold' }[]>([]);
  const [notificationCount, setNotificationCount] = useState(0);
  const [recentNotifications, setRecentNotifications] = useState<{ id: string; title: string; message: string; date: Date }[]>([]);
  const [showNotificationMenu, setShowNotificationMenu] = useState(false);
  const lastPollTimeRef = useRef<string>(new Date().toISOString());

  // Audio double-chime generator (Web Audio API)
  const playChime = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }
      
      // Tone 1: D5
      const osc1 = audioCtx.createOscillator();
      const gain1 = audioCtx.createGain();
      osc1.connect(gain1);
      gain1.connect(audioCtx.destination);
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, audioCtx.currentTime);
      gain1.gain.setValueAtTime(0.08, audioCtx.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
      osc1.start(audioCtx.currentTime);
      osc1.stop(audioCtx.currentTime + 0.3);
      
      // Tone 2: A5
      const osc2 = audioCtx.createOscillator();
      const gain2 = audioCtx.createGain();
      osc2.connect(gain2);
      gain2.connect(audioCtx.destination);
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(880.00, audioCtx.currentTime + 0.12);
      gain2.gain.setValueAtTime(0.08, audioCtx.currentTime + 0.12);
      gain2.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);
      osc2.start(audioCtx.currentTime + 0.12);
      osc2.stop(audioCtx.currentTime + 0.5);
    } catch (err) {
      console.warn('Audio chime blocked or unsupported:', err);
    }
  };

  // Ask browser push notification permissions on load
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission();
      }
    }
  }, []);

  // Poll for dashboard updates
  useEffect(() => {
    if (!user) return;

    const poll = async () => {
      try {
        const since = lastPollTimeRef.current;
        const res = await fetch(`/api/admin/notifications/poll?since=${encodeURIComponent(since)}`);
        if (!res.ok) return;

        const data = await res.json();
        if (data.timestamp) {
          lastPollTimeRef.current = data.timestamp;
        }

        const newEvents: { id: string; title: string; message: string; type: 'order' | 'hold' }[] = [];

        // Paid Orders
        if (data.orders && data.orders.length > 0) {
          data.orders.forEach((o: any) => {
            const formattedTotal = Number(o.total).toLocaleString('en-IN', { style: 'currency', currency: 'INR' });
            newEvents.push({
              id: o.id + '_order',
              title: 'New Paid Order!',
              message: `Order ${o.orderNumber} (${formattedTotal}) received from ${o.customerName}.`,
              type: 'order',
            });
          });
        }

        // Active Holds
        if (data.holds && data.holds.length > 0) {
          data.holds.forEach((h: any) => {
            newEvents.push({
              id: h.id + '_hold',
              title: 'New Hold Request!',
              message: `"${h.productName}" placed on hold by ${h.customerName}.`,
              type: 'hold',
            });
          });
        }

        if (newEvents.length > 0) {
          // Play chime
          playChime();

          // Native notification
          if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
            newEvents.forEach((ev) => {
              new Notification(ev.title, {
                body: ev.message,
                tag: ev.id,
              });
            });
          }

          // In-app toasts
          setToasts((prev) => [...prev, ...newEvents]);

          newEvents.forEach((ev) => {
            setTimeout(() => {
              setToasts((prev) => prev.filter((t) => t.id !== ev.id));
            }, 6000);
          });

          // Updates list
          setNotificationCount((prev) => prev + newEvents.length);
          setRecentNotifications((prev) => [
            ...newEvents.map((ev) => ({ id: ev.id, title: ev.title, message: ev.message, date: new Date() })),
            ...prev
          ].slice(0, 10));
        }
      } catch (err) {
        console.error('Notification polling error:', err);
      }
    };

    poll();
    const interval = setInterval(poll, 15000);
    return () => clearInterval(interval);
  }, [user]);

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
            {/* Notifications Button */}
            <div className="relative">
              <button 
                onClick={() => {
                  setShowNotificationMenu(!showNotificationMenu);
                  setNotificationCount(0);
                }}
                className="hover:text-primary transition-colors relative cursor-pointer flex items-center justify-center"
              >
                <span className="material-symbols-outlined text-[24px]">notifications</span>
                {notificationCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-primary text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center font-bold font-label-sm animate-pulse">
                    {notificationCount}
                  </span>
                )}
              </button>

              {showNotificationMenu && (
                <div className="absolute right-0 mt-2 w-80 bg-surface-container-lowest border border-outline-variant/50 rounded-lg shadow-md p-2 z-50 flex flex-col gap-1 max-h-96 overflow-y-auto">
                  <div className="px-3 py-2 border-b border-outline-variant/20 mb-1 flex justify-between items-center">
                    <span className="font-label-md text-xs text-on-surface font-semibold">Boutique Alerts</span>
                    {recentNotifications.length > 0 && (
                      <button 
                        onClick={() => setRecentNotifications([])}
                        className="text-[10px] text-primary hover:underline font-label-sm uppercase"
                      >
                        Clear All
                      </button>
                    )}
                  </div>
                  {recentNotifications.length === 0 ? (
                    <div className="text-center py-6 text-xs text-on-surface-variant">
                      No new notification alerts.
                    </div>
                  ) : (
                    recentNotifications.map((notif) => (
                      <div key={notif.id} className="p-2 hover:bg-surface-container-low/30 rounded text-xs border-b border-outline-variant/10 last:border-b-0 text-left">
                        <div className="font-semibold text-primary">{notif.title}</div>
                        <div className="text-on-surface-variant mt-0.5">{notif.message}</div>
                        <div className="text-[9px] text-outline mt-1">
                          {new Date(notif.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

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
      {/* Real-time Toasts Float */}
      <div className="fixed bottom-20 md:bottom-6 right-6 flex flex-col gap-3 z-50 max-w-sm w-full pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`p-4 rounded-lg shadow-lg border text-white transition-all duration-300 pointer-events-auto flex items-start gap-3 animate-slide-up ${
              toast.type === 'order'
                ? 'bg-[#755566] border-[#755566]/20'
                : 'bg-primary-container/95 text-primary border-primary/20'
            }`}
          >
            <span className="material-symbols-outlined mt-0.5">
              {toast.type === 'order' ? 'payments' : 'bookmark'}
            </span>
            <div className="flex-grow">
              <div className="font-semibold text-sm">{toast.title}</div>
              <div className="text-xs mt-0.5 opacity-90">{toast.message}</div>
            </div>
            <button
              onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
              className="text-white/60 hover:text-white transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          </div>
        ))}
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes slideUp {
          from { transform: translateY(1rem); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .animate-slide-up {
          animation: slideUp 0.3s ease-out forwards;
        }
      ` }} />
    </div>
  );
}
