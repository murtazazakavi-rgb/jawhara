'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  getConversationMessages, 
  sendWhatsAppChatMessage, 
  getCustomerContext, 
  assignSalesperson,
  getAISuggestedReplies
} from './actions';
import { createPaymentRequestAction } from '../products/[id]/actions';
import Link from 'next/link';

interface Customer {
  id: string;
  name: string;
  mobile: string;
  city: string | null;
}

interface Conversation {
  id: string;
  customerId: string;
  waId: string;
  status: string;
  unreadCount: number;
  lastMessageAt: string | Date;
  assignedUserId: string | null;
  customer: Customer;
}

interface Message {
  id: string;
  direction: 'INBOUND' | 'OUTBOUND';
  type: string;
  status: 'QUEUED' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';
  body: string | null;
  createdAt: string | Date;
  mediaUrl: string | null;
}

interface Salesperson {
  id: string;
  name: string;
  role: string;
}

interface InboxProps {
  initialConversations: Conversation[];
  salesTeam: Salesperson[];
  currentUser: { id: string; name: string; role: string };
}

export default function WhatsAppInboxClient({ 
  initialConversations, 
  salesTeam, 
  currentUser 
}: InboxProps) {
  const [conversations, setConversations] = useState<Conversation[]>(initialConversations);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [crmContext, setCrmContext] = useState<any>(null);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingCrm, setLoadingCrm] = useState(false);
  const [sendingMsg, setSendingMsg] = useState(false);
  const [aiReplies, setAiReplies] = useState<{ option1: string; option2: string; option3: string } | null>(null);
  const [loadingAiReplies, setLoadingAiReplies] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activeConv = conversations.find(c => c.id === activeConvId);

  // Auto-scroll chat thread to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom();
    }
  }, [messages]);

  // Load chat messages when active conversation changes
  useEffect(() => {
    setAiReplies(null); // Clear suggestions on chat switch
    if (!activeConvId) {
      setMessages([]);
      setCrmContext(null);
      return;
    }

    const loadThread = async () => {
      setLoadingMessages(true);
      try {
        const list = await getConversationMessages(activeConvId);
        // Map dates
        setMessages(list.map(m => ({ ...m, createdAt: new Date(m.createdAt) } as any)));
        
        // Clear unread badge locally
        setConversations(prev => 
          prev.map(c => c.id === activeConvId ? { ...c, unreadCount: 0 } : c)
        );
      } catch (err) {
        console.error('Error loading chat thread:', err);
      } finally {
        setLoadingMessages(false);
      }
    };

    const loadCrm = async () => {
      if (!activeConv) return;
      setLoadingCrm(true);
      try {
        const ctx = await getCustomerContext(activeConv.customerId);
        setCrmContext(ctx);
      } catch (err) {
        console.error('Error loading CRM context:', err);
      } finally {
        setLoadingCrm(false);
      }
    };

    loadThread();
    loadCrm();
  }, [activeConvId]);

  // Periodic poll for new messages (simulating real-time sockets)
  useEffect(() => {
    const timer = setInterval(async () => {
      if (!activeConvId) return;
      try {
        const list = await getConversationMessages(activeConvId);
        setMessages(list.map(m => ({ ...m, createdAt: new Date(m.createdAt) } as any)));
      } catch (err) {
        console.error('Error polling thread:', err);
      }
    }, 5000);

    return () => clearInterval(timer);
  }, [activeConvId]);

  // Handle AI suggestions loading
  const loadAiSuggestions = async () => {
    if (!activeConv) return;
    setLoadingAiReplies(true);
    setAiReplies(null);
    try {
      const res = await getAISuggestedReplies(activeConv.customerId, activeConv.id);
      setAiReplies(res);
    } catch (err) {
      console.error(err);
      alert('Failed to load AI suggestions.');
    } finally {
      setLoadingAiReplies(false);
    }
  };

  // Handle outbound message sending
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeConvId || !inputText.trim() || sendingMsg) return;

    setSendingMsg(true);
    const textToSend = inputText;
    setInputText('');

    try {
      const res = await sendWhatsAppChatMessage(activeConvId, textToSend);
      if (res.error) {
        alert(res.error);
        setInputText(textToSend); // restore
      } else if (res.message) {
        setMessages(prev => [...prev, { ...res.message, createdAt: new Date(res.message.createdAt) } as any]);
      }
    } catch (err) {
      console.error(err);
      alert('Failed to send message.');
    } finally {
      setSendingMsg(false);
    }
  };

  // Handle salesperson assignment changes
  const handleAssignChange = async (userId: string) => {
    if (!activeConvId) return;
    try {
      const res = await assignSalesperson(activeConvId, userId || null);
      if (res.error) {
        alert(res.error);
      } else {
        setConversations(prev => 
          prev.map(c => c.id === activeConvId ? { ...c, assignedUserId: userId || null } : c)
        );
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Helper to construct a WhatsApp share link context directly
  const handleSendProductRecommend = async (prodCode: string, name: string, price: number) => {
    const introText = `Hi, checking in if you liked the newly available ${name} (Code: ${prodCode}, price ₹${price.toLocaleString('en-IN')}). Let me know if I can hold this piece for you!`;
    setInputText(introText);
  };

  // Filter conversations based on sidebar search query
  const filteredConversations = conversations.filter(c => {
    const nameMatch = c.customer.name.toLowerCase().includes(searchQuery.toLowerCase());
    const phoneMatch = c.waId.includes(searchQuery);
    return nameMatch || phoneMatch;
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 border border-outline-variant/30 rounded-lg overflow-hidden min-h-[75vh] bg-surface-container-lowest shadow-sm">
      
      {/* COLUMN 1: Conversations Sidebar List */}
      <div className="lg:col-span-3 border-r border-outline-variant/30 flex flex-col bg-surface-container-lowest">
        <div className="p-4 border-b border-outline-variant/20">
          <h2 className="font-display font-medium text-headline-sm text-primary mb-3">WhatsApp Sales</h2>
          <div className="relative">
            <input 
              type="text" 
              placeholder="Search chat or number..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-surface-container-low border border-outline-variant/50 rounded px-3 py-1.5 text-body-md placeholder-on-surface-variant/40 focus:outline-none focus:border-primary text-xs"
            />
            <span className="material-symbols-outlined absolute right-2 top-2 text-outline text-[18px]">search</span>
          </div>
        </div>

        <div className="flex-grow overflow-y-auto divide-y divide-outline-variant/10 max-h-[60vh] lg:max-h-[65vh]">
          {filteredConversations.length === 0 ? (
            <p className="p-4 text-center text-outline text-xs">No conversations found</p>
          ) : (
            filteredConversations.map((conv) => {
              const isActive = conv.id === activeConvId;
              const formattedDate = new Date(conv.lastMessageAt).toLocaleDateString('en-IN', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true,
              });

              return (
                <button
                  key={conv.id}
                  onClick={() => setActiveConvId(conv.id)}
                  className={`w-full text-left p-4 flex flex-col gap-1 transition-colors hover:bg-surface-container-low/50 ${
                    isActive ? 'bg-surface-container-low border-l-4 border-primary' : ''
                  }`}
                >
                  <div className="flex justify-between items-center w-full">
                    <span className="font-label-md text-on-surface truncate pr-2">{conv.customer.name}</span>
                    <span className="font-label-sm text-[10px] text-outline whitespace-nowrap">{formattedDate}</span>
                  </div>
                  <div className="flex justify-between items-center w-full">
                    <span className="font-body-sm text-xs text-outline-variant truncate">{conv.waId}</span>
                    {conv.unreadCount > 0 && (
                      <span className="bg-primary text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center justify-center min-w-4">
                        {conv.unreadCount}
                      </span>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* COLUMN 2: Message Thread & Composer */}
      <div className="lg:col-span-6 flex flex-col bg-surface">
        {activeConvId ? (
          <>
            {/* Header info */}
            <div className="px-6 py-4 border-b border-outline-variant/30 flex justify-between items-center bg-surface-container-lowest">
              <div>
                <h3 className="font-display font-medium text-headline-sm text-on-surface">{activeConv?.customer.name}</h3>
                <p className="text-[10px] text-outline">{activeConv?.waId}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-label-sm text-[11px] text-outline">Assignee:</span>
                <select
                  value={activeConv?.assignedUserId || ''}
                  onChange={(e) => handleAssignChange(e.target.value)}
                  className="bg-surface border border-outline-variant/50 rounded px-2 py-1 text-xs focus:outline-none focus:border-primary"
                >
                  <option value="">Unassigned</option>
                  {salesTeam.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.role})</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Chat Timeline */}
            <div className="flex-grow overflow-y-auto p-6 space-y-4 max-h-[50vh] min-h-[45vh] bg-[#FBF9F7]">
              {loadingMessages ? (
                <div className="flex items-center justify-center h-full">
                  <span className="material-symbols-outlined animate-spin text-primary text-3xl">sync</span>
                </div>
              ) : messages.length === 0 ? (
                <p className="text-center text-outline text-xs py-8">No messages in this conversation thread.</p>
              ) : (
                messages.map((msg) => {
                  const isOutbound = msg.direction === 'OUTBOUND';
                  const timestamp = new Date(msg.createdAt).toLocaleTimeString('en-IN', {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: true,
                  });

                  return (
                    <div 
                      key={msg.id} 
                      className={`flex flex-col max-w-[80%] ${isOutbound ? 'ml-auto items-end' : 'mr-auto items-start'}`}
                    >
                      <div 
                        className={`rounded-lg px-4 py-2 text-body-md text-xs shadow-sm leading-relaxed ${
                          isOutbound 
                            ? 'bg-primary text-white rounded-tr-none' 
                            : 'bg-surface-container-lowest text-on-surface border border-outline-variant/30 rounded-tl-none'
                        }`}
                      >
                        {msg.body}
                      </div>
                      <div className="flex items-center gap-1 mt-1 text-[9px] text-outline">
                        <span>{timestamp}</span>
                        {isOutbound && (
                          <span className="material-symbols-outlined text-[10px] text-primary flex">
                            {msg.status === 'READ' ? 'done_all' : msg.status === 'DELIVERED' ? 'done_all' : 'done'}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* AI Suggested Replies Panel */}
            <div className="px-6 py-3 border-t border-outline-variant/20 bg-surface-container-low flex flex-col gap-2">
              <div className="flex justify-between items-center">
                <span className="font-label-sm text-[11px] font-semibold text-primary flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">psychology</span>
                  AI Suggested Replies Co-Pilot
                </span>
                {!aiReplies && !loadingAiReplies && (
                  <button
                    type="button"
                    onClick={loadAiSuggestions}
                    className="text-primary hover:underline text-[10px] font-label-md uppercase tracking-wider"
                  >
                    Suggest Drafts
                  </button>
                )}
                {(aiReplies || loadingAiReplies) && (
                  <button
                    type="button"
                    onClick={() => setAiReplies(null)}
                    className="text-outline hover:underline text-[10px]"
                  >
                    Clear Suggestions
                  </button>
                )}
              </div>

              {loadingAiReplies && (
                <div className="flex items-center gap-2 text-xs text-outline py-1 animate-pulse">
                  <span className="material-symbols-outlined animate-spin text-[14px]">sync</span>
                  Analyzing conversation history & live inventory details...
                </div>
              )}

              {aiReplies && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-1">
                  <button
                    type="button"
                    onClick={() => setInputText(aiReplies.option1)}
                    className="p-2.5 border border-outline-variant/40 rounded text-[11px] text-left bg-surface-container-lowest text-on-surface hover:border-primary/50 transition-colors line-clamp-3 leading-relaxed"
                    title={aiReplies.option1}
                  >
                    <span className="font-semibold text-primary block mb-0.5 text-[9px] uppercase tracking-wider">Option 1: Checking In</span>
                    {aiReplies.option1}
                  </button>
                  <button
                    type="button"
                    onClick={() => setInputText(aiReplies.option2)}
                    className="p-2.5 border border-outline-variant/40 rounded text-[11px] text-left bg-surface-container-lowest text-on-surface hover:border-primary/50 transition-colors line-clamp-3 leading-relaxed"
                    title={aiReplies.option2}
                  >
                    <span className="font-semibold text-primary block mb-0.5 text-[9px] uppercase tracking-wider">Option 2: Product Pitch</span>
                    {aiReplies.option2}
                  </button>
                  <button
                    type="button"
                    onClick={() => setInputText(aiReplies.option3)}
                    className="p-2.5 border border-outline-variant/40 rounded text-[11px] text-left bg-surface-container-lowest text-on-surface hover:border-primary/50 transition-colors line-clamp-3 leading-relaxed"
                    title={aiReplies.option3}
                  >
                    <span className="font-semibold text-primary block mb-0.5 text-[9px] uppercase tracking-wider">Option 3: Hold/Checkout Push</span>
                    {aiReplies.option3}
                  </button>
                </div>
              )}
            </div>

            {/* Input Composer */}
            <form onSubmit={handleSend} className="p-4 border-t border-outline-variant/30 bg-surface-container-lowest flex gap-3 items-center">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Type your WhatsApp message..."
                disabled={sendingMsg}
                className="flex-grow bg-surface border border-outline-variant/50 rounded-lg px-4 py-2.5 text-body-md focus:outline-none focus:border-primary placeholder-on-surface-variant/30 text-xs"
              />
              <button
                type="submit"
                disabled={sendingMsg || !inputText.trim()}
                className="bg-primary hover:bg-primary/90 text-white rounded-lg px-4 py-2.5 transition-colors flex items-center justify-center disabled:opacity-50"
              >
                {sendingMsg ? (
                  <span className="material-symbols-outlined animate-spin text-sm">sync</span>
                ) : (
                  <span className="material-symbols-outlined text-sm">send</span>
                )}
              </button>
            </form>
          </>
        ) : (
          <div className="flex-grow flex flex-col items-center justify-center p-8 text-center text-outline">
            <span className="material-symbols-outlined text-outline/40 text-[56px] mb-2">forum</span>
            <p className="font-display font-medium text-headline-sm mb-1 text-primary">No Active Conversation</p>
            <p className="text-xs text-outline max-w-[280px]">Select a customer conversation from the left sidebar to start messaging and close sales.</p>
          </div>
        )}
      </div>

      {/* COLUMN 3: Customer Context CRM Intelligence */}
      <div className="lg:col-span-3 border-l border-outline-variant/30 flex flex-col bg-surface-container-lowest max-h-[75vh] overflow-y-auto">
        <div className="p-4 border-b border-outline-variant/20 bg-surface-container-low/30">
          <h3 className="font-display font-medium text-label-md text-primary uppercase tracking-wider">Customer Intelligence</h3>
        </div>

        {activeConvId && crmContext ? (
          <div className="p-4 space-y-5">
            {/* Contact details */}
            <div className="space-y-1">
              <div className="flex justify-between items-start">
                <h4 className="font-display font-semibold text-headline-sm text-on-surface truncate">{crmContext.customerName}</h4>
                <Link 
                  href={`/customers/${activeConv?.customerId}`}
                  className="text-primary hover:underline text-[10px] font-label-md pt-1 whitespace-nowrap"
                >
                  View Profile
                </Link>
              </div>
              <p className="text-[11px] text-outline">{crmContext.mobile} · {crmContext.city}</p>
            </div>

            {/* Financial indicators */}
            <div className="grid grid-cols-2 gap-2 border-y border-outline-variant/15 py-3">
              <div className="text-center">
                <span className="text-[9px] uppercase tracking-wider text-outline block">Lifetime Spend</span>
                <span className="font-display font-bold text-headline-md text-primary">
                  ₹{crmContext.ltv.toLocaleString('en-IN')}
                </span>
              </div>
              <div className="text-center border-l border-outline-variant/15">
                <span className="text-[9px] uppercase tracking-wider text-outline block">Total Orders</span>
                <span className="font-display font-bold text-headline-md text-on-surface">
                  {crmContext.orderCount}
                </span>
              </div>
            </div>

            {/* User Preferences */}
            <div className="space-y-3">
              <div>
                <span className="text-[10px] uppercase tracking-wider text-outline block">Preferred Colors</span>
                <span className="font-body-sm text-xs text-on-surface">{crmContext.preferredColours}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase tracking-wider text-outline block">Price Tier Range</span>
                <span className="font-body-sm text-xs text-on-surface">{crmContext.priceRangePreference}</span>
              </div>
            </div>

            {/* Active Holds / Reservations */}
            <div className="space-y-2">
              <span className="text-[10px] uppercase tracking-wider text-outline block">Active Reservations</span>
              {crmContext.reservations.length === 0 ? (
                <p className="text-[11px] italic text-outline">No active items on hold</p>
              ) : (
                crmContext.reservations.map((res: any) => {
                  const expiry = res.expiresAt 
                    ? new Date(res.expiresAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
                    : 'No limit';
                  return (
                    <div key={res.id} className="p-2 border border-outline-variant/30 rounded bg-[#FAF8F6] text-[11px] flex flex-col gap-1">
                      <div className="flex justify-between font-semibold text-on-surface">
                        <span className="truncate pr-1">{res.product.name}</span>
                        <span>₹{Number(res.product.price).toLocaleString('en-IN')}</span>
                      </div>
                      <div className="flex justify-between text-[10px] text-outline">
                        <span>Code: {res.product.productCode}</span>
                        <span>Holds until: {expiry}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Recent Orders */}
            <div className="space-y-2">
              <span className="text-[10px] uppercase tracking-wider text-outline block">Recent Orders</span>
              {crmContext.orders.length === 0 ? (
                <p className="text-[11px] italic text-outline">No order history</p>
              ) : (
                <div className="space-y-2">
                  {crmContext.orders.slice(0, 3).map((ord: any) => {
                    const isUnpaid = ord.paymentStatus === 'UNPAID';
                    return (
                      <div key={ord.id} className="p-2.5 border border-outline-variant/30 rounded bg-[#FAF8F6] text-[11px] flex flex-col gap-1.5">
                        <div className="flex justify-between font-semibold text-on-surface">
                          <span>Order {ord.orderNumber}</span>
                          <span>₹{Number(ord.total).toLocaleString('en-IN')}</span>
                        </div>
                        <div className="flex justify-between items-center text-[10px]">
                          <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${
                            ord.paymentStatus === 'PAID' ? 'bg-success/15 text-success' : 'bg-warning/15 text-warning'
                          }`}>
                            {ord.paymentStatus}
                          </span>
                          {isUnpaid && (
                            <button
                              onClick={async () => {
                                const confirmReq = confirm(`Generate and send payment link for Order ${ord.orderNumber}?`);
                                if (!confirmReq) return;
                                const actionRes = await createPaymentRequestAction({ orderId: ord.id });
                                if (actionRes.error) {
                                  alert(actionRes.error);
                                } else {
                                  alert('Payment link generated and sent on WhatsApp successfully!');
                                  // Refresh CRM context
                                  if (activeConv) {
                                    const updatedCtx = await getCustomerContext(activeConv.customerId);
                                    setCrmContext(updatedCtx);
                                  }
                                }
                              }}
                              className="bg-primary hover:bg-primary/95 text-white px-2 py-0.5 rounded text-[9px] font-label-md transition-colors"
                            >
                              Request Payment
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* AI Smart Recommendations */}
            <div className="space-y-2">
              <span className="text-[10px] uppercase tracking-wider text-outline block">✨ AI Recommended Matches</span>
              {crmContext.recommended.length === 0 ? (
                <p className="text-[11px] italic text-outline">No matching available stock</p>
              ) : (
                <div className="space-y-2">
                  {crmContext.recommended.map((prod: any) => (
                    <div 
                      key={prod.id} 
                      className="p-2.5 border border-outline-variant/20 rounded bg-secondary-container/10 flex flex-col gap-1.5 transition-all hover:border-primary/30"
                    >
                      <div className="flex justify-between text-[11px] font-semibold text-on-surface">
                        <span className="truncate pr-1">{prod.name}</span>
                        <span>₹{Number(prod.price).toLocaleString('en-IN')}</span>
                      </div>
                      <div className="flex justify-between items-center text-[10px]">
                        <span className="text-outline">{prod.productCode}</span>
                        <button
                          onClick={() => handleSendProductRecommend(prod.productCode, prod.name, Number(prod.price))}
                          className="bg-primary hover:bg-primary/95 text-white px-2 py-0.5 rounded text-[9px] font-label-md flex items-center gap-1 transition-all"
                        >
                          <span className="material-symbols-outlined text-[10px]">chat</span>
                          Suggest
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        ) : activeConvId && loadingCrm ? (
          <div className="flex flex-col items-center justify-center p-8 h-40">
            <span className="material-symbols-outlined animate-spin text-primary text-2xl">sync</span>
            <p className="text-xs text-outline mt-2">Loading CRM context...</p>
          </div>
        ) : (
          <div className="p-8 text-center text-outline-variant">
            <span className="material-symbols-outlined text-[36px] mb-1">analytics</span>
            <p className="text-xs">Select a conversation thread to review intelligence profiles.</p>
          </div>
        )}
      </div>

    </div>
  );
}
