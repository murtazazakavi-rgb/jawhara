'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { changeClientPasswordAction, clientSendMessageAction, getClientMessagesAction } from '../shop/actions';
import CustomerPageHeader from '@/components/CustomerPageHeader';
import { useToast } from '@/components/Toast';

interface OrderItem {
  id: string;
  name: string;
  slug: string;
  quantity: number;
  imageUrl: string | null;
}

interface Order {
  id: string;
  orderNumber: string;
  total: number;
  status: string;
  paymentStatus: string;
  createdAt: string;
  paymentUrl: string | null;
  items: OrderItem[];
  tracking: { courierName: string | null; number: string | null; url: string | null } | null;
}

interface ChatMessage {
  id: string;
  direction: 'INBOUND' | 'OUTBOUND';
  body: string | null;
  createdAt: string;
}

interface AccountClientProps {
  profile: { name: string; email: string; mobile: string | null };
  orders: Order[];
  chatMessages: ChatMessage[];
  isDefaultPassword: boolean;
}

const PROGRESS_STEPS = ['Placed', 'Packing', 'Shipped', 'Delivered'];

/** Customer-facing wording and progress step for an order's status. */
function describeOrder(order: Order): { label: string; step: number | null; tone: 'ok' | 'warn' | 'muted' } {
  if (order.paymentStatus === 'UNPAID' || order.paymentStatus === 'FAILED') {
    return { label: 'Awaiting payment', step: null, tone: 'warn' };
  }
  if (order.paymentStatus === 'REFUNDED' || order.paymentStatus === 'PARTIALLY_REFUNDED') {
    return { label: 'Refunded', step: null, tone: 'muted' };
  }
  switch (order.status) {
    case 'PENDING':
      return { label: 'Order placed', step: 0, tone: 'ok' };
    case 'PACKING':
    case 'READY_FOR_PICKUP':
    case 'PICKUP_REQUESTED':
      return { label: 'Being packed', step: 1, tone: 'ok' };
    case 'DISPATCHED':
    case 'IN_TRANSIT':
      return { label: 'On the way', step: 2, tone: 'ok' };
    case 'OUT_FOR_DELIVERY':
      return { label: 'Out for delivery', step: 2, tone: 'ok' };
    case 'DELIVERY_FAILED':
      return { label: 'Delivery attempt failed — we’ll be in touch', step: 2, tone: 'warn' };
    case 'DELIVERED':
      return { label: 'Delivered', step: 3, tone: 'ok' };
    case 'RETURNED':
      return { label: 'Returned', step: null, tone: 'muted' };
    default:
      return { label: order.status, step: null, tone: 'muted' };
  }
}

// WhatsApp-created customers get a placeholder login email; don't show it
const isPlaceholderEmail = (email: string) => email.endsWith('@whatsapp.jawhara.com');

export default function AccountClient({ profile, orders, chatMessages, isDefaultPassword }: AccountClientProps) {
  const router = useRouter();
  const toast = useToast();

  // Messages
  const [messages, setMessages] = useState<ChatMessage[]>(chatMessages);
  const [newMsg, setNewMsg] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prevLengthRef = useRef(messages.length);

  // Password
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (messages.length > prevLengthRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    prevLengthRef.current = messages.length;
  }, [messages.length]);

  // Poll for staff replies while the page is visible
  useEffect(() => {
    const timer = setInterval(async () => {
      if (document.hidden) return;
      try {
        const res = await getClientMessagesAction();
        if (res.messages) setMessages(res.messages as ChatMessage[]);
      } catch (err) {
        console.error('Error polling messages:', err);
      }
    }, 8000);
    return () => clearInterval(timer);
  }, []);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = newMsg.trim();
    if (!text || sendingMsg) return;

    setSendingMsg(true);
    try {
      const res = await clientSendMessageAction({ body: text });
      if (res.error) {
        toast.error(res.error);
      } else {
        setNewMsg('');
        setMessages((prev) => [
          ...prev,
          { id: `local-${Date.now()}`, direction: 'INBOUND', body: text, createdAt: new Date().toISOString() },
        ]);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to send message.');
    } finally {
      setSendingMsg(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');

    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match.');
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError('Use at least 6 characters.');
      return;
    }

    setChangingPassword(true);
    try {
      const res = await changeClientPasswordAction({ oldPassword, newPassword });
      if (res.error) {
        setPasswordError(res.error);
      } else {
        toast.success('Password updated.');
        setOldPassword('');
        setNewPassword('');
        setConfirmPassword('');
        router.refresh();
      }
    } catch (err) {
      console.error(err);
      setPasswordError('Something went wrong while changing your password.');
    } finally {
      setChangingPassword(false);
    }
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await fetch('/shop/api/logout', { method: 'POST' });
    } finally {
      window.location.href = '/';
    }
  };

  const inputClass =
    'w-full bg-transparent border border-outline-variant/60 focus:border-primary rounded-lg px-3 h-11 outline-none text-base transition-colors';

  return (
    <div className="bg-surface text-on-surface min-h-screen font-body-md flex flex-col">
      <CustomerPageHeader title="Account" subtitle={profile.name} />

      <main className="max-w-3xl w-full mx-auto px-4 sm:px-6 py-6 flex-grow space-y-8">
        {isDefaultPassword && (
          <a
            href="#password"
            className="bg-warning/10 border border-warning/30 text-on-surface p-4 rounded-xl flex items-start gap-3"
          >
            <span className="material-symbols-outlined text-warning shrink-0">lock</span>
            <span className="text-sm">
              <strong className="block">Set your own password</strong>
              You’re still using the starter password. Choose a new one below to keep your account safe.
            </span>
          </a>
        )}

        {/* Profile */}
        <section className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center text-lg font-semibold shrink-0">
            {profile.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-grow text-sm">
            <p className="text-base font-semibold text-on-surface truncate">{profile.name}</p>
            {profile.mobile && <p className="text-on-surface-variant">{profile.mobile}</p>}
            {!isPlaceholderEmail(profile.email) && <p className="text-on-surface-variant truncate">{profile.email}</p>}
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            disabled={signingOut}
            className="h-10 px-4 rounded-full border border-outline-variant text-sm text-on-surface-variant hover:border-primary hover:text-primary transition-colors shrink-0 disabled:opacity-50 cursor-pointer"
          >
            {signingOut ? 'Signing out…' : 'Sign out'}
          </button>
        </section>

        {/* Orders */}
        <section id="orders" className="space-y-3 scroll-mt-24">
          <h2 className="font-display text-xl text-primary">My orders</h2>

          {orders.length === 0 ? (
            <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-6 text-center space-y-3">
              <p className="text-sm text-on-surface-variant">You haven’t placed any orders yet.</p>
              <Link
                href="/"
                className="inline-flex items-center justify-center h-11 px-6 bg-primary text-on-primary text-sm font-semibold rounded-full hover:opacity-90"
              >
                Browse pieces
              </Link>
            </div>
          ) : (
            orders.map((order) => {
              const info = describeOrder(order);
              const first = order.items[0];
              return (
                <article key={order.id} className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-4 space-y-4">
                  <div className="flex gap-3">
                    <div className="relative w-16 h-20 rounded-lg overflow-hidden bg-surface-container-low shrink-0 flex items-center justify-center">
                      {first?.imageUrl ? (
                        <Image src={first.imageUrl} alt={first.name} fill sizes="64px" className="object-cover" />
                      ) : (
                        <span className="material-symbols-outlined text-outline/50">image</span>
                      )}
                    </div>
                    <div className="min-w-0 flex-grow">
                      <p className="text-base font-semibold text-on-surface line-clamp-1">
                        {first?.name ?? 'Order'}
                        {order.items.length > 1 && (
                          <span className="font-normal text-on-surface-variant"> +{order.items.length - 1} more</span>
                        )}
                      </p>
                      <p className="text-sm text-on-surface-variant">
                        {order.orderNumber} ·{' '}
                        {new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                      <p className="text-base text-primary font-semibold mt-0.5">₹{order.total.toLocaleString('en-IN')}</p>
                    </div>
                  </div>

                  <p
                    className={`text-sm font-medium ${
                      info.tone === 'warn' ? 'text-warning' : info.tone === 'ok' ? 'text-success' : 'text-on-surface-variant'
                    }`}
                  >
                    {info.label}
                  </p>

                  {info.step !== null && (
                    <ol className="grid grid-cols-4 gap-1" aria-label="Order progress">
                      {PROGRESS_STEPS.map((step, idx) => {
                        const done = idx <= info.step!;
                        return (
                          <li key={step} className="flex flex-col gap-1.5" aria-current={idx === info.step ? 'step' : undefined}>
                            <span className={`h-1.5 rounded-full ${done ? 'bg-primary' : 'bg-outline-variant/40'}`} />
                            <span className={`text-xs ${done ? 'text-on-surface' : 'text-outline'}`}>{step}</span>
                          </li>
                        );
                      })}
                    </ol>
                  )}

                  {order.tracking?.number && (
                    <p className="text-sm text-on-surface-variant">
                      {order.tracking.courierName ? `${order.tracking.courierName} · ` : ''}Tracking {order.tracking.number}
                    </p>
                  )}

                  <div className="flex flex-wrap gap-2">
                    {order.paymentStatus === 'UNPAID' &&
                      (order.paymentUrl ? (
                        <a
                          href={order.paymentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="h-10 px-4 rounded-full bg-primary text-on-primary text-sm font-semibold flex items-center gap-1.5"
                        >
                          <span className="material-symbols-outlined text-[18px]">payments</span>
                          Complete payment
                        </a>
                      ) : (
                        <Link
                          href="/dashboard"
                          className="h-10 px-4 rounded-full bg-primary text-on-primary text-sm font-semibold flex items-center gap-1.5"
                        >
                          <span className="material-symbols-outlined text-[18px]">schedule</span>
                          Pay from My Holds
                        </Link>
                      ))}
                    {order.tracking?.url && (
                      <a
                        href={order.tracking.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="h-10 px-4 rounded-full border border-outline-variant text-sm text-on-surface flex items-center gap-1.5 hover:border-primary"
                      >
                        <span className="material-symbols-outlined text-[18px]">local_shipping</span>
                        Track parcel
                      </a>
                    )}
                    <Link
                      href={`/orders/${order.id}/receipt`}
                      className="h-10 px-4 rounded-full border border-outline-variant text-sm text-on-surface flex items-center gap-1.5 hover:border-primary"
                    >
                      <span className="material-symbols-outlined text-[18px]">receipt_long</span>
                      Receipt
                    </Link>
                  </div>
                </article>
              );
            })
          )}
        </section>

        {/* Messages */}
        <section id="messages" className="space-y-3 scroll-mt-24">
          <h2 className="font-display text-xl text-primary">Messages</h2>
          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-4 flex flex-col gap-3">
            <div className="max-h-[50vh] min-h-[160px] overflow-y-auto space-y-3 p-1" aria-live="polite">
              {messages.length === 0 ? (
                <p className="text-sm text-on-surface-variant text-center py-8">
                  Questions about a piece, sizing or delivery? Send us a message and the boutique team will reply here.
                </p>
              ) : (
                messages.map((m) => {
                  const mine = m.direction === 'INBOUND';
                  return (
                    <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                          mine ? 'bg-primary text-on-primary rounded-tr-none' : 'bg-surface-container-high text-on-surface rounded-tl-none'
                        }`}
                      >
                        {m.body}
                        <span className={`block text-xs mt-1 text-right ${mine ? 'text-on-primary/70' : 'text-outline'}`}>
                          {new Date(m.createdAt).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>
            <form onSubmit={handleSendMessage} className="flex gap-2 pt-3 border-t border-outline-variant/20">
              <label htmlFor="message" className="sr-only">Message to the boutique</label>
              <input
                id="message"
                type="text"
                placeholder="Write a message…"
                value={newMsg}
                onChange={(e) => setNewMsg(e.target.value)}
                className={`${inputClass} flex-grow`}
              />
              <button
                type="submit"
                disabled={sendingMsg || !newMsg.trim()}
                className="h-11 w-11 shrink-0 rounded-full bg-primary text-on-primary flex items-center justify-center disabled:opacity-50 cursor-pointer"
                aria-label="Send message"
              >
                <span className="material-symbols-outlined text-[20px]">{sendingMsg ? 'progress_activity' : 'send'}</span>
              </button>
            </form>
          </div>
        </section>

        {/* Password */}
        <section id="password" className="space-y-3 scroll-mt-24">
          <h2 className="font-display text-xl text-primary">Password</h2>
          <form
            onSubmit={handleChangePassword}
            className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-4 space-y-4"
          >
            <div className="flex flex-col gap-1.5">
              <label htmlFor="currentPassword" className="text-sm text-on-surface-variant">Current password</label>
              <input
                id="currentPassword"
                type="password"
                autoComplete="current-password"
                required
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                className={inputClass}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="newPassword" className="text-sm text-on-surface-variant">New password</label>
                <input
                  id="newPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="confirmPassword" className="text-sm text-on-surface-variant">Confirm new password</label>
                <input
                  id="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={6}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>
            {passwordError && (
              <p role="alert" className="text-sm text-error">{passwordError}</p>
            )}
            <button
              type="submit"
              disabled={changingPassword}
              className="h-11 px-6 rounded-full bg-primary text-on-primary text-sm font-semibold disabled:opacity-50 cursor-pointer"
            >
              {changingPassword ? 'Updating…' : 'Update password'}
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}
