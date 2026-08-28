'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Script from 'next/script';
import { 
  cancelReservationAction, 
  changeClientPasswordAction,
  clientSendMessageAction,
  getClientMessagesAction,
  clientCheckoutAction
} from '../shop/actions';
import CheckoutModal from '@/components/CheckoutModal';

interface Reservation {
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

interface Order {
  id: string;
  orderNumber: string;
  total: number;
  status: string;
  paymentStatus: string;
  createdAt: string;
  paymentRequestUrl: string | null;
}

interface ChatMessage {
  id: string;
  direction: 'INBOUND' | 'OUTBOUND';
  body: string | null;
  createdAt: string;
}

interface ShopDashboardClientProps {
  customerName: string;
  activeHolds: Reservation[];
  orders: Order[];
  isDefaultPassword?: boolean;
  chatMessages?: ChatMessage[];
}

export default function ShopDashboardClient({
  customerName,
  activeHolds,
  orders,
  isDefaultPassword = false,
  chatMessages = [],
}: ShopDashboardClientProps) {
  const router = useRouter();
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [checkingOutId, setCheckingOutId] = useState<string | null>(null);
  const [expiredHolds, setExpiredHolds] = useState<Record<string, boolean>>({});
  
  // Checkout Modal State
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [checkoutHold, setCheckoutHold] = useState<Reservation | null>(null);

  // Chat messaging states
  const [messages, setMessages] = useState<ChatMessage[]>(chatMessages);
  const [newMsg, setNewMsg] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isMountedRef = useRef(false);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMsg.trim() || sendingMsg) return;

    const currentMsgText = newMsg.trim();
    setNewMsg('');
    setSendingMsg(true);

    try {
      const res = await clientSendMessageAction({ body: currentMsgText });
      if (res.error) {
        alert(res.error);
      } else {
        const tempMsg: ChatMessage = {
          id: Math.random().toString(),
          direction: 'INBOUND',
          body: currentMsgText,
          createdAt: new Date().toISOString(),
        };
        setMessages(prev => [...prev, tempMsg]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSendingMsg(false);
    }
  };

  // Scroll to bottom on new messages (only when count increases)
  const prevLengthRef = useRef(messages.length);
  useEffect(() => {
    if (messages.length > prevLengthRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
    prevLengthRef.current = messages.length;
  }, [messages.length]);

  // Periodic poll for staff replies
  useEffect(() => {
    const pollTimer = setInterval(async () => {
      try {
        const res = await getClientMessagesAction();
        if (res.messages) {
          setMessages(res.messages as any);
        }
      } catch (err) {
        console.error('Error polling client messages:', err);
      }
    }, 8000);

    return () => clearInterval(pollTimer);
  }, []);

  // Expiration timers state
  const [timeRemaining, setTimeRemaining] = useState<Record<string, string>>({});

  // Password change states
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match.');
      return;
    }

    if (newPassword.length < 4) {
      setPasswordError('Password must be at least 4 characters long.');
      return;
    }

    setChangingPassword(true);
    try {
      const res = await changeClientPasswordAction({
        oldPassword,
        newPassword,
      });

      if (res.error) {
        setPasswordError(res.error);
      } else {
        setPasswordSuccess('Password updated successfully!');
        setOldPassword('');
        setNewPassword('');
        setConfirmPassword('');
        router.refresh();
      }
    } catch (err) {
      console.error(err);
      setPasswordError('An error occurred while changing your password.');
    } finally {
      setChangingPassword(false);
    }
  };

  useEffect(() => {
    let needsRefresh = false;
    const updateTimers = () => {
      const newTimers: Record<string, string> = {};
      activeHolds.forEach((hold) => {
        if (!hold.expiresAt) {
          newTimers[hold.id] = 'No Limit';
          return;
        }
        
        const expiry = new Date(hold.expiresAt).getTime();
        const now = Date.now();
        const diff = expiry - now;

        if (diff <= 0) {
          newTimers[hold.id] = 'Expired / Processing release';
          if (!expiredHolds[hold.id]) {
            needsRefresh = true;
            setExpiredHolds(prev => ({ ...prev, [hold.id]: true }));
          }
        } else {
          const minutes = Math.floor(diff / 60000);
          const seconds = Math.floor((diff % 60000) / 1000);
          newTimers[hold.id] = `${minutes}m ${seconds}s remaining`;
        }
      });
      setTimeRemaining(newTimers);
      if (needsRefresh) {
        router.refresh();
      }
    };

    updateTimers();
    const interval = setInterval(updateTimers, 1000);
    return () => clearInterval(interval);
  }, [activeHolds, expiredHolds, router]);

  const handleCancelHold = async (reservationId: string) => {
    if (!confirm('Are you sure you want to release this piece? It will be immediately made available for other boutique customers.')) {
      return;
    }

    setCancellingId(reservationId);
    try {
      const res = await cancelReservationAction(reservationId);
      if (res.error) {
        alert(res.error);
      } else {
        alert('Piece released back to inventory.');
        router.refresh();
      }
    } catch (err) {
      console.error(err);
      alert('Failed to release piece.');
    } finally {
      setCancellingId(null);
    }
  };

  const triggerCheckout = (hold: Reservation) => {
    setCheckoutHold(hold);
    setIsCheckoutOpen(true);
  };

  const handleCheckout = async (reservationId: string, notes?: string) => {
    setCheckingOutId(reservationId);
    try {
      const res = await clientCheckoutAction({ reservationId, notes });
      if (res.error) {
        alert(res.error);
        setCheckingOutId(null);
      } else if (res.useStandardCheckout) {
        // Standard Checkout Modal Integration
        const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
        if (!keyId) {
          alert('Razorpay Key ID is missing in environment variables.');
          setCheckingOutId(null);
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
              // Verify signature
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
            } finally {
              setCheckingOutId(null);
            }
          },
          prefill: {
            name: res.customerName,
            email: res.customerEmail || undefined,
            contact: res.customerMobile || undefined,
          },
          theme: {
            color: '#E4C8CF',
          },
          modal: {
            ondismiss: function () {
              setCheckingOutId(null);
            },
          },
        };

        const rzp = new (window as any).Razorpay(options);
        rzp.on('payment.failed', function (response: any) {
          alert(`Payment failed: ${response.error.description}`);
          setCheckingOutId(null);
        });
        rzp.open();
      } else if (res.paymentUrl) {
        // Redirect to Razorpay payment page
        window.open(res.paymentUrl, '_blank');
        alert('Checkout initiated! A payment page has opened in a new tab. Once payment succeeds, your order status will be updated on your dashboard.');
        router.refresh();
        setCheckingOutId(null);
      } else {
        alert('Checkout initiated successfully.');
        router.refresh();
        setCheckingOutId(null);
      }
    } catch (err) {
      console.error(err);
      alert('Failed to initiate checkout.');
      setCheckingOutId(null);
    }
  };

  return (
    <div className="bg-surface text-on-surface min-h-screen font-body-md flex flex-col relative overflow-x-hidden">
      {/* Rose Watermark background */}
      <div className="fixed inset-0 rose-watermark opacity-[0.02] z-0 pointer-events-none"></div>

      {/* Header bar */}
      <header className="w-full py-6 border-b border-outline-variant/20 bg-surface-container-lowest z-10 sticky top-0 shadow-sm">
        <div className="max-w-container-max mx-auto px-4 sm:px-6 md:px-8 flex justify-between items-center">
          <Link href="/" className="flex items-center gap-2 text-primary hover:opacity-80 transition-opacity">
            <span className="material-symbols-outlined">arrow_back</span>
            <span className="font-label-md uppercase tracking-wider text-xs">Back to Gallery</span>
          </Link>
          <div className="text-right">
            <span className="font-label-md text-xs text-outline uppercase tracking-wider block">Customer Dashboard</span>
            <span className="font-body-md text-sm text-on-surface font-semibold">{customerName}</span>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-container-max w-full mx-auto px-4 sm:px-6 md:px-8 py-10 flex-grow relative z-10 space-y-6">
        
        {isDefaultPassword && (
          <div className="bg-error/10 border border-error/20 text-error p-4 rounded-xl flex items-start gap-3 animate-pulse">
            <span className="material-symbols-outlined shrink-0 text-lg">warning</span>
            <div>
              <h4 className="font-label-md text-xs uppercase tracking-wide font-bold">Default Password Security Alert</h4>
              <p className="text-xs mt-1 leading-relaxed">
                You are currently logged in with the default password <strong>123456</strong>. Please change it immediately in the form below to secure your customer session details.
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Active Holds */}
        <section className="lg:col-span-6 space-y-6">
          <h2 className="font-display text-2xl text-primary font-light border-b border-outline-variant/20 pb-3 flex items-center gap-2">
            <span className="material-symbols-outlined">lock</span>
            My Active Holds
          </h2>

          {activeHolds.length === 0 ? (
            <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-8 text-center space-y-3">
              <span className="material-symbols-outlined text-outline/30 text-5xl">inventory_2</span>
              <p className="font-body-md text-on-surface-variant italic text-sm">You have no items currently on hold.</p>
              <Link
                href="/"
                className="inline-block bg-primary text-white text-xs font-label-md uppercase tracking-wider px-4 py-2 rounded-lg hover:opacity-90 transition-opacity"
              >
                Browse Pieces
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {activeHolds.map((hold) => {
                const img = hold.product.images[0]?.url || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150';
                return (
                  <div 
                    key={hold.id}
                    className="bg-surface-container-lowest border border-[#E4C8CF] rounded-xl p-4 flex gap-4 shadow-sm relative overflow-hidden"
                  >
                    {/* Pink accent side bar for active holds */}
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#E4C8CF]"></div>
                    
                    <Link 
                      href={`/p/${hold.product.slug}`}
                      className="w-20 h-24 bg-surface-container-low rounded-lg overflow-hidden shrink-0 block hover:opacity-90 transition-opacity"
                    >
                      <img src={img} alt={hold.product.name} className="w-full h-full object-cover" />
                    </Link>
                    
                    <div className="flex-grow flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-start gap-2">
                          <Link href={`/p/${hold.product.slug}`} className="hover:text-primary transition-colors hover:underline">
                            <h3 className="font-label-md text-sm text-on-surface font-semibold line-clamp-1">
                              {hold.product.name}
                            </h3>
                          </Link>
                          <span className="font-mono text-[10px] text-outline shrink-0">{hold.product.productCode}</span>
                        </div>
                        <p className="font-headline-sm text-primary text-xs font-semibold mt-1">
                          ₹{hold.product.price.toLocaleString('en-IN')}
                        </p>
                      </div>

                      <div className="mt-3 flex items-center justify-between gap-2 pt-2 border-t border-outline-variant/10">
                        <span className="text-xs font-label-sm text-error font-semibold flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px]">schedule</span>
                          {timeRemaining[hold.id] || 'Calculating...'}
                        </span>

                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => handleCancelHold(hold.id)}
                            disabled={cancellingId === hold.id || checkingOutId === hold.id}
                            className="text-[10px] font-label-md text-error hover:underline uppercase tracking-wider cursor-pointer disabled:opacity-50"
                          >
                            Release Hold
                          </button>
                          
                          <button
                            onClick={() => triggerCheckout(hold)}
                            disabled={cancellingId === hold.id || checkingOutId === hold.id}
                            className="px-3 py-1 bg-primary text-white hover:opacity-90 disabled:opacity-50 text-[10px] font-label-md uppercase tracking-wider rounded cursor-pointer"
                          >
                            {checkingOutId === hold.id ? 'Loading...' : 'Buy Now'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Right Column: Invoice / Orders History */}
        <section className="lg:col-span-6 space-y-6">
          <h2 className="font-display text-2xl text-primary font-light border-b border-outline-variant/20 pb-3 flex items-center gap-2">
            <span className="material-symbols-outlined">receipt_long</span>
            Purchase & Invoice History
          </h2>

          {orders.length === 0 ? (
            <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-8 text-center">
              <p className="font-body-md text-on-surface-variant italic text-sm">No transaction records found.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {orders.map((ord) => (
                <div 
                  key={ord.id}
                  className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-4 space-y-3 shadow-sm"
                >
                  <div className="flex justify-between items-center border-b border-outline-variant/10 pb-2">
                    <div>
                      <span className="font-label-md text-sm text-on-surface font-semibold">Order {ord.orderNumber}</span>
                      <span className="text-[10px] text-outline ml-3">{new Date(ord.createdAt).toLocaleDateString()}</span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <span className={`text-[9px] font-label-sm px-2 py-0.5 rounded uppercase border font-semibold ${
                        ord.paymentStatus === 'PAID'
                          ? 'bg-success/10 text-success border-success/20'
                          : 'bg-error/10 text-error border-error/20'
                      }`}>
                        {ord.paymentStatus}
                      </span>
                      <Link
                        href={`/orders/${ord.id}/receipt`}
                        className="text-primary hover:text-primary-hover flex items-center gap-0.5 text-[10px] font-label-md uppercase tracking-wider font-semibold border border-primary/25 rounded px-2 py-0.5 hover:bg-primary/5 transition-all"
                      >
                        <span className="material-symbols-outlined text-[12px]">receipt_long</span>
                        Receipt
                      </Link>
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-xs">
                    <div>
                      <span className="text-outline">Order Status: </span>
                      <span className="font-semibold text-on-surface-variant uppercase">
                        {ord.status === 'PENDING'
                          ? 'Payment Pending'
                          : ord.status === 'PACKING'
                          ? 'Order Placed Successfully'
                          : ord.status === 'DISPATCHED'
                          ? 'Shipped / Dispatched'
                          : ord.status === 'DELIVERED'
                          ? 'Delivered'
                          : ord.status === 'RETURNED'
                          ? 'Returned'
                          : ord.status}
                      </span>
                    </div>
                    <div>
                      <span className="text-outline">Amount: </span>
                      <span className="font-headline-sm text-primary font-bold">₹{ord.total.toLocaleString('en-IN')}</span>
                    </div>
                  </div>

                  {ord.paymentStatus === 'UNPAID' && (
                    <div className="pt-2 border-t border-outline-variant/10 flex justify-end">
                      {ord.paymentRequestUrl ? (
                        <Link
                          href={ord.paymentRequestUrl}
                          className="bg-primary text-white text-[10px] font-label-md uppercase tracking-wider px-3.5 py-1.5 rounded hover:opacity-90 transition-opacity flex items-center gap-1"
                        >
                          <span className="material-symbols-outlined text-[12px]">payments</span>
                          Complete Payment
                        </Link>
                      ) : (
                        <span className="text-[10px] font-label-md text-outline italic uppercase tracking-wider">
                          Payment Link Pending Staff Approval
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Direct Inquiries / Chat section */}
        <section className="lg:col-span-12 mt-6">
          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-6 md:p-8 shadow-sm flex flex-col h-[500px]">
            <h2 className="font-display text-xl text-primary font-light border-b border-outline-variant/20 pb-3 flex items-center gap-2 mb-4">
              <span className="material-symbols-outlined">forum</span>
              Direct Inquiries & Chat
            </h2>

            {/* Messages Feed */}
            <div className="flex-grow overflow-y-auto p-4 space-y-4 bg-surface-container-low/20 rounded-xl border border-outline-variant/10 min-h-[250px]">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-2">
                  <span className="material-symbols-outlined text-outline/40 text-4xl">chat_bubble</span>
                  <p className="font-body-md text-sm text-on-surface-variant italic">No messages yet. Send a query below to start a chat with our boutique staff.</p>
                </div>
              ) : (
                messages.map((m) => {
                  const isCustomer = m.direction === 'INBOUND';
                  return (
                    <div 
                      key={m.id}
                      className={`flex w-full ${isCustomer ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                        isCustomer 
                          ? 'bg-primary text-white rounded-tr-none' 
                          : 'bg-surface-container-high text-on-surface rounded-tl-none border border-outline-variant/10'
                      }`}>
                        {m.body}
                        <span className={`block text-[9px] mt-1 text-right ${
                          isCustomer ? 'text-white/60' : 'text-outline'
                        }`}>
                          {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Form */}
            <form onSubmit={handleSendMessage} className="mt-4 flex gap-2 pt-2 border-t border-outline-variant/10">
              <input
                type="text"
                required
                disabled={sendingMsg}
                placeholder="Type your message to the boutique..."
                value={newMsg}
                onChange={(e) => setNewMsg(e.target.value)}
                className="flex-grow bg-transparent border border-outline-variant/50 focus:border-primary rounded-xl px-4 py-2.5 outline-none font-body-md text-sm transition-colors"
              />
              <button
                type="submit"
                disabled={sendingMsg || !newMsg.trim()}
                className="bg-primary text-white px-5 py-2.5 rounded-xl hover:opacity-95 transition-opacity disabled:opacity-50 flex items-center justify-center gap-1.5 font-label-md text-xs uppercase tracking-wider cursor-pointer"
              >
                {sendingMsg ? 'Sending...' : 'Send'}
                <span className="material-symbols-outlined text-sm">send</span>
              </button>
            </form>
          </div>
        </section>

        {/* Change Password Card Section */}
        <section className="lg:col-span-12 mt-6">
          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-6 md:p-8 shadow-sm">
            <h2 className="font-display text-xl text-primary font-light border-b border-outline-variant/20 pb-3 flex items-center gap-2 mb-6">
              <span className="material-symbols-outlined">key</span>
              Update Portal Password
            </h2>

            {passwordError && (
              <div className="bg-error/10 border border-error/20 text-error text-xs p-3 rounded-lg mb-4">
                {passwordError}
              </div>
            )}

            {passwordSuccess && (
              <div className="bg-success/15 border border-success/30 text-success text-xs p-3 rounded-lg mb-4">
                {passwordSuccess}
              </div>
            )}

            <form onSubmit={handleChangePassword} className="max-w-md space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="font-label-md text-xs text-on-surface-variant uppercase">Current Password</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  className="bg-transparent border-b border-outline-variant/50 focus:border-primary py-2 outline-none font-body-md text-sm transition-colors"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="font-label-md text-xs text-on-surface-variant uppercase">New Password</label>
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="bg-transparent border-b border-outline-variant/50 focus:border-primary py-2 outline-none font-body-md text-sm transition-colors"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="font-label-md text-xs text-on-surface-variant uppercase">Confirm New Password</label>
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="bg-transparent border-b border-outline-variant/50 focus:border-primary py-2 outline-none font-body-md text-sm transition-colors"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={changingPassword}
                className="bg-primary text-white text-xs font-label-md uppercase tracking-wider px-5 py-2.5 rounded-lg hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50 flex items-center gap-1.5 mt-4"
              >
                {changingPassword ? 'Updating...' : 'Update Password'}
                <span className="material-symbols-outlined text-sm">lock_reset</span>
              </button>
            </form>
          </div>
        </section>
      </div>
    </main>

    {/* Footer */}
    <footer className="w-full py-8 border-t border-outline-variant/20 bg-surface-container-lowest mt-16 text-center">
      <p className="text-[10px] font-mono text-outline">
        © {new Date().getFullYear()} Jawhara - Dynamic Lookbook by MJZ
      </p>
    </footer>
    <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
    {/* Checkout Options Modal */}
    <CheckoutModal
      isOpen={isCheckoutOpen}
      onClose={() => setIsCheckoutOpen(false)}
      onConfirm={(notes) => {
        if (checkoutHold) {
          handleCheckout(checkoutHold.id, notes);
        }
        setIsCheckoutOpen(false);
      }}
      price={checkoutHold?.product.price || 0}
    />
  </div>
  );
}
