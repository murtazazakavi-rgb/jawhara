'use client';

import React, { useState, useEffect } from 'react';

interface Approval {
  id: string;
  type: string;
  entityType?: string;
  entityId?: string;
  title: string;
  rationale: string;
  proposedContent?: Record<string, unknown>;
  impact?: string;
  status: string;
  createdAt: string;
}

export default function ApprovalsClient() {
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedDrafts, setSelectedDrafts] = useState<Record<string, number>>({});

  useEffect(() => {
    fetchApprovals();
  }, []);

  async function fetchApprovals() {
    setLoading(true);
    try {
      const res = await fetch('/api/ai/approvals?status=PENDING');
      const data = await res.json();
      setApprovals(data.approvals ?? []);
    } catch (err) {
      console.error('Failed to load approvals:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleAction(
    approvalId: string,
    action: 'APPROVED' | 'REJECTED' | 'DISMISSED'
  ) {
    setActionLoading(approvalId + action);
    try {
      await fetch(`/api/ai/approvals/${approvalId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      setApprovals((prev) => prev.filter((a) => a.id !== approvalId));
    } catch (err) {
      console.error('Failed to update approval:', err);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleSend(approval: Approval) {
    setActionLoading(approval.id + 'SEND');
    try {
      // First approve
      await fetch(`/api/ai/approvals/${approval.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'APPROVED' }),
      });

      // Then execute
      const draftIndex = selectedDrafts[approval.id] ?? 0;
      await fetch(`/api/ai/approvals/${approval.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draftIndex }),
      });

      setApprovals((prev) => prev.filter((a) => a.id !== approval.id));
    } catch (err) {
      console.error('Failed to send approval:', err);
    } finally {
      setActionLoading(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="material-symbols-outlined animate-spin text-primary text-3xl">refresh</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display font-semibold text-headline-md text-on-surface">
          Review Queue
        </h1>
        <p className="text-body-sm text-on-surface-variant mt-1">
          Messages and actions prepared by Jawhara for your approval.
        </p>
      </div>

      {approvals.length === 0 && (
        <div className="text-center py-20 text-on-surface-variant">
          <span className="material-symbols-outlined text-5xl block mb-4 opacity-30">done_all</span>
          <p className="font-medium">All caught up!</p>
          <p className="text-sm mt-1">Nothing is waiting for your approval right now.</p>
        </div>
      )}

      <div className="space-y-4">
        {approvals.map((approval) => {
          const content = approval.proposedContent as Record<string, unknown> | undefined;
          const drafts: string[] = Array.isArray(content?.drafts) ? content.drafts as string[] : [];
          const selectedIndex = selectedDrafts[approval.id] ?? 0;
          const isWA = approval.type === 'WHATSAPP_MESSAGE';
          const isLoading = actionLoading?.startsWith(approval.id);

          return (
            <div
              key={approval.id}
              className="bg-surface-container rounded-3xl border border-outline-variant/30 overflow-hidden"
            >
              {/* Header */}
              <div className="px-6 pt-5 pb-4 border-b border-outline-variant/20">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="material-symbols-outlined text-primary text-base">
                        {isWA ? 'chat' : 'auto_awesome'}
                      </span>
                      <span className="text-xs uppercase tracking-wider font-medium text-on-surface-variant">
                        {approval.type.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <p className="font-semibold text-on-surface">{approval.title}</p>
                  </div>
                  <span className="text-xs text-on-surface-variant shrink-0">
                    {new Date(approval.createdAt).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>

                <p className="text-sm text-on-surface-variant mt-2">{approval.rationale}</p>
                {approval.impact && (
                  <p className="text-xs text-on-surface-variant/70 mt-1 italic">
                    Impact: {approval.impact}
                  </p>
                )}
              </div>

              {/* Draft selection for WhatsApp messages */}
              {isWA && drafts.length > 0 && (
                <div className="px-6 py-4 space-y-3">
                  <p className="text-xs font-medium text-on-surface-variant uppercase tracking-wider">
                    Select a message to send:
                  </p>
                  {drafts.map((draft, idx) => (
                    <button
                      key={idx}
                      onClick={() =>
                        setSelectedDrafts((prev) => ({ ...prev, [approval.id]: idx }))
                      }
                      className={`w-full text-left rounded-2xl p-4 text-sm border transition-colors ${
                        selectedIndex === idx
                          ? 'border-primary bg-primary/10 text-on-surface'
                          : 'border-outline-variant/30 bg-surface text-on-surface-variant hover:border-primary/30'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <span
                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${
                            selectedIndex === idx
                              ? 'border-primary bg-primary'
                              : 'border-outline-variant'
                          }`}
                        >
                          {selectedIndex === idx && (
                            <span className="material-symbols-outlined text-on-primary text-xs">check</span>
                          )}
                        </span>
                        <span className="whitespace-pre-wrap leading-relaxed">{draft}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Actions */}
              <div className="px-6 pb-5 flex items-center gap-3 flex-wrap">
                {isWA && drafts.length > 0 && (
                  <button
                    onClick={() => handleSend(approval)}
                    disabled={!!isLoading}
                    className="bg-primary text-on-primary px-5 py-2.5 rounded-full text-sm font-medium disabled:opacity-50 flex items-center gap-2"
                  >
                    <span className="material-symbols-outlined text-sm">send</span>
                    Send Message
                  </button>
                )}

                {!isWA && (
                  <button
                    onClick={() => handleAction(approval.id, 'APPROVED')}
                    disabled={!!isLoading}
                    className="bg-primary text-on-primary px-5 py-2.5 rounded-full text-sm font-medium disabled:opacity-50 flex items-center gap-2"
                  >
                    <span className="material-symbols-outlined text-sm">check</span>
                    Approve
                  </button>
                )}

                <button
                  onClick={() => handleAction(approval.id, 'REJECTED')}
                  disabled={!!isLoading}
                  className="border border-outline-variant text-on-surface-variant px-5 py-2.5 rounded-full text-sm font-medium disabled:opacity-50 hover:border-error hover:text-error transition-colors"
                >
                  Reject
                </button>

                <button
                  onClick={() => handleAction(approval.id, 'DISMISSED')}
                  disabled={!!isLoading}
                  className="text-on-surface-variant text-sm hover:text-on-surface transition-colors px-2"
                >
                  Dismiss
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
