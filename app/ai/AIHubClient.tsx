'use client';

import React, { useState } from 'react';
import Link from 'next/link';

interface Suggestion {
  id: string;
  section: string;
  title: string;
  body: string;
  priority: 'HIGH' | 'NORMAL' | 'LOW';
  action?: string;
}

interface TodaySummary {
  followUpCustomers: number;
  expiringReservations: number;
  outstandingPaymentsTotal: number;
  outstandingPaymentsCount: number;
  productsNeedingDescriptions: number;
  ordersReadyForPickup: number;
  ordersInTransit: number;
  deliveryExceptions: number;
  pendingApprovals: number;
}

const SECTION_ICONS: Record<string, string> = {
  Sales: 'trending_up',
  Reservations: 'schedule',
  Payments: 'payments',
  Products: 'inventory_2',
  Delivery: 'local_shipping',
  AI: 'auto_awesome',
};

const PRIORITY_CLASSES: Record<string, string> = {
  HIGH: 'border-l-4 border-error bg-error/5',
  NORMAL: 'border-l-4 border-primary bg-primary/5',
  LOW: 'border-l-4 border-outline-variant bg-surface-container',
};

const ACTION_HREFS: Record<string, string> = {
  'View Customers': '/customers',
  'View Reservations': '/orders',
  'View Orders': '/orders',
  'Arrange Pickup': '/orders',
  'View Shipments': '/orders',
  'Review Exception': '/orders',
  Review: '/ai/approvals',
  'View Products': '/products',
  'Draft WhatsApp': '/whatsapp',
};

export default function AIHubClient({
  initialSuggestions,
  initialSummary,
}: {
  initialSuggestions: Suggestion[];
  initialSummary: TodaySummary;
}) {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<{ answer: string; suggestions?: string[] } | null>(null);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState('');

  const suggestions = initialSuggestions;
  const summary = initialSummary;

  const highCount = suggestions.filter((s) => s.priority === 'HIGH').length;

  async function handleAsk(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim()) return;
    setAsking(true);
    setError('');
    setAnswer(null);

    try {
      const res = await fetch('/api/ai/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not get an answer.');
      setAnswer(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setAsking(false);
    }
  }

  const quickQuestions = [
    "What's most important today?",
    'Which customers need follow-up?',
    'How much is outstanding?',
    'Which reservations expire soon?',
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display font-semibold text-headline-md text-on-surface">
            Jawhara Assistant
          </h1>
          <p className="text-body-sm text-on-surface-variant mt-1">
            Your business at a glance — powered by real data.
          </p>
        </div>
        {summary.pendingApprovals > 0 && (
          <Link
            href="/ai/approvals"
            className="flex items-center gap-2 bg-primary text-on-primary px-4 py-2 rounded-full text-sm font-medium"
          >
            <span className="material-symbols-outlined text-sm">pending_actions</span>
            {summary.pendingApprovals} Pending
          </Link>
        )}
      </div>

      {/* Today at a Glance — stat chips */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {summary.outstandingPaymentsCount > 0 && (
          <Link href="/orders" className="bg-error/10 border border-error/20 rounded-2xl p-4 hover:bg-error/15 transition-colors">
            <p className="text-xs text-error font-medium uppercase tracking-wider">Outstanding</p>
            <p className="text-xl font-bold text-error mt-1">
              ₹{Number(summary.outstandingPaymentsTotal).toLocaleString('en-IN')}
            </p>
            <p className="text-xs text-on-surface-variant mt-1">{summary.outstandingPaymentsCount} order{summary.outstandingPaymentsCount !== 1 ? 's' : ''}</p>
          </Link>
        )}
        {summary.expiringReservations > 0 && (
          <Link href="/orders" className="bg-warning/10 border border-warning/20 rounded-2xl p-4 hover:bg-warning/15 transition-colors">
            <p className="text-xs text-warning font-medium uppercase tracking-wider">Expiring Today</p>
            <p className="text-xl font-bold text-warning mt-1">{summary.expiringReservations}</p>
            <p className="text-xs text-on-surface-variant mt-1">hold{summary.expiringReservations !== 1 ? 's' : ''}</p>
          </Link>
        )}
        {summary.ordersReadyForPickup > 0 && (
          <Link href="/orders" className="bg-primary/10 border border-primary/20 rounded-2xl p-4 hover:bg-primary/15 transition-colors">
            <p className="text-xs text-primary font-medium uppercase tracking-wider">Ready for Pickup</p>
            <p className="text-xl font-bold text-primary mt-1">{summary.ordersReadyForPickup}</p>
            <p className="text-xs text-on-surface-variant mt-1">order{summary.ordersReadyForPickup !== 1 ? 's' : ''}</p>
          </Link>
        )}
        {summary.ordersInTransit > 0 && (
          <div className="bg-surface-container border border-outline-variant/30 rounded-2xl p-4">
            <p className="text-xs text-on-surface-variant font-medium uppercase tracking-wider">In Transit</p>
            <p className="text-xl font-bold text-on-surface mt-1">{summary.ordersInTransit}</p>
            <p className="text-xs text-on-surface-variant mt-1">shipment{summary.ordersInTransit !== 1 ? 's' : ''}</p>
          </div>
        )}
        {summary.deliveryExceptions > 0 && (
          <Link href="/orders" className="bg-error/10 border border-error/20 rounded-2xl p-4 hover:bg-error/15 transition-colors">
            <p className="text-xs text-error font-medium uppercase tracking-wider">Delivery Exception</p>
            <p className="text-xl font-bold text-error mt-1">{summary.deliveryExceptions}</p>
            <p className="text-xs text-on-surface-variant mt-1">need{summary.deliveryExceptions !== 1 ? '' : 's'} attention</p>
          </Link>
        )}
        {summary.followUpCustomers > 0 && (
          <Link href="/customers" className="bg-surface-container border border-outline-variant/30 rounded-2xl p-4 hover:bg-surface-container-high transition-colors">
            <p className="text-xs text-on-surface-variant font-medium uppercase tracking-wider">Follow-Up</p>
            <p className="text-xl font-bold text-on-surface mt-1">{summary.followUpCustomers}</p>
            <p className="text-xs text-on-surface-variant mt-1">customer{summary.followUpCustomers !== 1 ? 's' : ''}</p>
          </Link>
        )}
      </div>

      {/* Ask Jawhara */}
      <div className="bg-surface-container rounded-3xl p-6 border border-outline-variant/30">
        <div className="flex items-center gap-2 mb-4">
          <span className="material-symbols-outlined text-primary">auto_awesome</span>
          <h2 className="font-label-lg font-semibold text-on-surface">Ask Jawhara</h2>
        </div>

        <form onSubmit={handleAsk} className="flex gap-3">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="e.g. Which customers need follow-up this week?"
            className="flex-1 bg-surface border border-outline-variant/50 rounded-2xl px-4 py-3 text-sm text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50"
            disabled={asking}
          />
          <button
            type="submit"
            disabled={asking || !question.trim()}
            className="bg-primary text-on-primary px-5 py-3 rounded-2xl text-sm font-medium disabled:opacity-50 flex items-center gap-2"
          >
            {asking ? (
              <span className="material-symbols-outlined text-sm animate-spin">refresh</span>
            ) : (
              <span className="material-symbols-outlined text-sm">send</span>
            )}
            {asking ? 'Thinking…' : 'Ask'}
          </button>
        </form>

        {/* Quick question chips */}
        <div className="flex flex-wrap gap-2 mt-3">
          {quickQuestions.map((q) => (
            <button
              key={q}
              onClick={() => setQuestion(q)}
              className="text-xs bg-surface border border-outline-variant/30 text-on-surface-variant px-3 py-1.5 rounded-full hover:border-primary/40 hover:text-primary transition-colors"
            >
              {q}
            </button>
          ))}
        </div>

        {/* Answer */}
        {answer && (
          <div className="mt-5 bg-primary/5 border border-primary/15 rounded-2xl p-5">
            <p className="text-sm text-on-surface leading-relaxed whitespace-pre-wrap">{answer.answer}</p>
            {answer.suggestions && answer.suggestions.length > 0 && (
              <div className="mt-4 pt-4 border-t border-outline-variant/20">
                <p className="text-xs font-medium text-on-surface-variant uppercase tracking-wider mb-2">Suggested next steps</p>
                <ul className="space-y-1.5">
                  {answer.suggestions.map((s, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-on-surface">
                      <span className="material-symbols-outlined text-primary text-sm mt-0.5">arrow_forward</span>
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="mt-4 bg-error/10 border border-error/20 rounded-2xl p-4 text-sm text-error">
            {error}
          </div>
        )}
      </div>

      {/* Today's Suggestions */}
      {suggestions.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-label-lg font-semibold text-on-surface">
              Suggestions
              {highCount > 0 && (
                <span className="ml-2 bg-error text-on-error text-xs font-bold px-2 py-0.5 rounded-full">
                  {highCount} urgent
                </span>
              )}
            </h2>
          </div>

          <div className="space-y-3">
            {suggestions.map((s) => (
              <div
                key={s.id}
                className={`rounded-2xl p-4 ${PRIORITY_CLASSES[s.priority]}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <span className="material-symbols-outlined text-on-surface-variant text-xl mt-0.5">
                      {SECTION_ICONS[s.section] ?? 'circle'}
                    </span>
                    <div>
                      <p className="text-xs text-on-surface-variant uppercase tracking-wider font-medium mb-0.5">{s.section}</p>
                      <p className="text-sm font-semibold text-on-surface">{s.title}</p>
                      <p className="text-xs text-on-surface-variant mt-0.5">{s.body}</p>
                    </div>
                  </div>
                  {s.action && ACTION_HREFS[s.action] && (
                    <Link
                      href={ACTION_HREFS[s.action]}
                      className="shrink-0 text-xs font-medium text-primary hover:underline flex items-center gap-1"
                    >
                      {s.action}
                      <span className="material-symbols-outlined text-sm">arrow_forward</span>
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {suggestions.length === 0 && (
        <div className="text-center py-12 text-on-surface-variant">
          <span className="material-symbols-outlined text-4xl block mb-3 opacity-40">check_circle</span>
          <p className="text-sm">Everything is on track. No suggestions right now.</p>
        </div>
      )}

      {/* Quick Navigation */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { href: '/ai/approvals', icon: 'pending_actions', label: 'Approvals', count: summary.pendingApprovals },
          { href: '/customers', icon: 'group', label: 'Customers', count: summary.followUpCustomers },
          { href: '/orders', icon: 'inventory_2', label: 'Orders', count: summary.ordersReadyForPickup },
        ].map((nav) => (
          <Link
            key={nav.href}
            href={nav.href}
            className="flex items-center gap-3 bg-surface-container border border-outline-variant/30 rounded-2xl p-4 hover:bg-surface-container-high transition-colors"
          >
            <span className="material-symbols-outlined text-primary">{nav.icon}</span>
            <div>
              <p className="text-sm font-medium text-on-surface">{nav.label}</p>
              {nav.count > 0 && (
                <p className="text-xs text-on-surface-variant">{nav.count} need attention</p>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
