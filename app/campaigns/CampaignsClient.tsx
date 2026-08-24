'use client';

import React, { useState, useEffect } from 'react';
import { 
  getSegmentCustomerCount, 
  createCampaignBroadcast, 
  getCampaignAnalytics 
} from './actions';

interface Campaign {
  id: string;
  name: string;
  templateKey: string;
  body: string;
  segmentRules: string;
  status: string;
  sentCount: number;
  failedCount: number;
  createdAt: string | Date;
}

interface CampaignsProps {
  initialCampaigns: Campaign[];
}

export default function CampaignsClient({ initialCampaigns }: CampaignsProps) {
  const [campaigns, setCampaigns] = useState<Campaign[]>(initialCampaigns);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [activeAnalyticsId, setActiveAnalyticsId] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  // New Broadcast Form State
  const [name, setName] = useState('');
  const [templateKey, setTemplateKey] = useState('MARKETING_GENERIC');
  const [body, setBody] = useState('Dear {{name}},\n\nWe have just released our new Boutique collection. Stop by our lookbook to explore: http://localhost:3000');
  const [segmentType, setSegmentType] = useState<'all' | 'high_ltv' | 'no_orders' | 'color_sage'>('all');
  
  const [matchingCount, setMatchingCount] = useState<number | null>(null);
  const [loadingCount, setLoadingCount] = useState(false);
  const [sendingBroadcast, setSendingBroadcast] = useState(false);

  // Helper to compile rules based on selected segment
  const getRulesObject = () => {
    switch (segmentType) {
      case 'high_ltv': return { ltvMin: 50000 };
      case 'no_orders': return { noOrders: true };
      case 'color_sage': return { preferredColour: 'Sage Green' };
      default: return {};
    }
  };

  // Run dynamic recipients count matching
  useEffect(() => {
    const fetchCount = async () => {
      setLoadingCount(true);
      try {
        const count = await getSegmentCustomerCount(getRulesObject());
        setMatchingCount(count);
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingCount(false);
      }
    };
    fetchCount();
  }, [segmentType]);

  // Load campaign attribution analytics
  useEffect(() => {
    if (!activeAnalyticsId) {
      setAnalytics(null);
      return;
    }
    const loadReport = async () => {
      setLoadingAnalytics(true);
      try {
        const report = await getCampaignAnalytics(activeAnalyticsId);
        setAnalytics(report);
      } catch (err) {
        console.error(err);
        alert('Failed to load campaign analytics report.');
      } finally {
        setLoadingAnalytics(false);
      }
    };
    loadReport();
  }, [activeAnalyticsId]);

  // Handle broadcast submission
  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !body.trim() || sendingBroadcast) return;

    setSendingBroadcast(true);
    try {
      const res = await createCampaignBroadcast({
        name,
        templateKey,
        body,
        rules: getRulesObject(),
      });

      if (res.error) {
        alert(res.error);
      } else {
        alert('Broadcast dispatched successfully!');
        window.location.reload(); // Reload to pick up new campaign
      }
    } catch (err) {
      console.error(err);
      alert('Failed to dispatch broadcast.');
    } finally {
      setSendingBroadcast(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Action Header */}
      <div className="flex justify-between items-center bg-surface-container-lowest p-6 border border-outline-variant/30 rounded-xl shadow-sm">
        <div>
          <h2 className="font-display font-medium text-headline-sm text-primary">Marketing Campaigns</h2>
          <p className="text-xs text-outline-variant">Segment customer directories, dispatch templates broadcasts, and audit downstream attribution revenues.</p>
        </div>
        <button
          onClick={() => setIsDrawerOpen(true)}
          className="bg-primary hover:bg-primary/95 text-white rounded px-4 py-2 font-label-md text-xs uppercase tracking-wider transition-colors flex items-center gap-1.5"
        >
          <span className="material-symbols-outlined text-[16px]">campaign</span>
          New Broadcast
        </button>
      </div>

      {/* Campaigns Table */}
      <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="bg-surface-container-low border-b border-outline-variant/30 font-semibold text-outline-variant">
                <th className="p-4 uppercase tracking-wider">Campaign Name</th>
                <th className="p-4 uppercase tracking-wider">Date Dispatched</th>
                <th className="p-4 uppercase tracking-wider">Status</th>
                <th className="p-4 uppercase tracking-wider text-center">Recipients (Sent)</th>
                <th className="p-4 uppercase tracking-wider text-center">Failures</th>
                <th className="p-4 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/15">
              {campaigns.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-outline italic">No campaign history recorded</td>
                </tr>
              ) : (
                campaigns.map((c) => {
                  const dateStr = new Date(c.createdAt).toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  });

                  return (
                    <tr key={c.id} className="hover:bg-surface-container-low/20 transition-colors">
                      <td className="p-4 font-semibold text-on-surface text-sm">{c.name}</td>
                      <td className="p-4 text-outline">{dateStr}</td>
                      <td className="p-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          c.status === 'COMPLETED' ? 'bg-success/15 text-success' : 'bg-warning/15 text-warning'
                        }`}>
                          {c.status}
                        </span>
                      </td>
                      <td className="p-4 text-center font-semibold">{c.sentCount}</td>
                      <td className="p-4 text-center text-error font-medium">{c.failedCount}</td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => setActiveAnalyticsId(c.id)}
                          className="text-primary hover:underline font-semibold"
                        >
                          View Analytics
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* DRAWER: Create Broadcast */}
      {isDrawerOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex justify-end z-50">
          <div className="bg-surface-container-lowest border-l border-outline-variant/30 w-full max-w-md h-full flex flex-col p-6 md:p-8 shadow-2xl overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-display font-medium text-headline-sm text-primary">New Broadcast Campaign</h3>
              <button 
                onClick={() => setIsDrawerOpen(false)} 
                className="material-symbols-outlined text-outline-variant hover:text-on-surface text-xl"
              >
                close
              </button>
            </div>

            <form onSubmit={handleSendBroadcast} className="flex-grow flex flex-col gap-5">
              <div className="flex flex-col gap-1.5">
                <label className="font-label-md text-xs text-on-surface-variant uppercase">Campaign Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Festive Sage Launch"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-transparent border-0 border-b border-outline-variant focus:border-primary focus:ring-0 py-1.5 font-body-md text-xs"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-label-md text-xs text-on-surface-variant uppercase">WhatsApp Template Key</label>
                <select
                  value={templateKey}
                  onChange={(e) => setTemplateKey(e.target.value)}
                  className="w-full bg-transparent border-0 border-b border-outline-variant focus:border-primary focus:ring-0 py-1.5 font-body-md text-xs"
                >
                  <option value="MARKETING_GENERIC">Generic Promotion (Custom text)</option>
                  <option value="NEW_ARRIVALS">New Arrivals Showcase (Approved)</option>
                </select>
              </div>

              {/* Targeting rules selection */}
              <div className="flex flex-col gap-2">
                <label className="font-label-md text-xs text-on-surface-variant uppercase">Target Customer Segment</label>
                <div className="space-y-2 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer font-body-md">
                    <input
                      type="radio"
                      name="segment"
                      checked={segmentType === 'all'}
                      onChange={() => setSegmentType('all')}
                      className="text-primary focus:ring-primary border-outline"
                    />
                    <span>All Opt-in Customers</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer font-body-md">
                    <input
                      type="radio"
                      name="segment"
                      checked={segmentType === 'high_ltv'}
                      onChange={() => setSegmentType('high_ltv')}
                      className="text-primary focus:ring-primary border-outline"
                    />
                    <span>Premium Tier (LTV &gt; ₹50,000)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer font-body-md">
                    <input
                      type="radio"
                      name="segment"
                      checked={segmentType === 'no_orders'}
                      onChange={() => setSegmentType('no_orders')}
                      className="text-primary focus:ring-primary border-outline"
                    />
                    <span>Inactive Leads (No orders recorded)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer font-body-md">
                    <input
                      type="radio"
                      name="segment"
                      checked={segmentType === 'color_sage'}
                      onChange={() => setSegmentType('color_sage')}
                      className="text-primary focus:ring-primary border-outline"
                    />
                    <span>Affinity Match: Sage Green</span>
                  </label>
                </div>
              </div>

              {/* Preview target recipients count */}
              <div className="p-3 bg-secondary-container/10 border border-outline-variant/35 rounded text-xs flex justify-between items-center mt-2">
                <span className="text-outline">Live Match Preview:</span>
                <span className="font-bold text-primary font-mono">
                  {loadingCount ? 'calculating...' : `${matchingCount ?? 0} customers`}
                </span>
              </div>

              <div className="flex flex-col gap-1.5 mt-2">
                <label className="font-label-md text-xs text-on-surface-variant uppercase">WhatsApp Message Body</label>
                <textarea
                  required
                  rows={5}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Draft your broadcast copy. Use {{name}} to insert dynamic customer name salutations."
                  className="w-full bg-transparent border border-outline-variant/50 focus:border-primary rounded p-2.5 font-body-md text-xs resize-none"
                />
              </div>

              <div className="flex gap-4 mt-auto pt-6 border-t border-outline-variant/20">
                <button
                  type="button"
                  onClick={() => setIsDrawerOpen(false)}
                  className="flex-1 py-2 border border-primary text-primary rounded font-label-md text-xs uppercase tracking-wider hover:bg-primary/5 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={sendingBroadcast || matchingCount === 0}
                  className="flex-1 py-2 bg-primary text-white rounded font-label-md text-xs uppercase tracking-wider hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center gap-1.5"
                >
                  {sendingBroadcast ? (
                    <>
                      <span className="material-symbols-outlined animate-spin text-[16px]">sync</span>
                      Sending...
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[16px]">send</span>
                      Send Broadcast
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ANALYTICS REPORT DIALOG */}
      {activeAnalyticsId && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-6 md:p-8 max-w-2xl w-full shadow-2xl relative overflow-y-auto max-h-[85vh]">
            <div className="flex justify-between items-center border-b border-outline-variant/20 pb-4 mb-6">
              <h3 className="font-display font-medium text-headline-sm text-primary">Campaign Performance Report</h3>
              <button 
                onClick={() => setActiveAnalyticsId(null)} 
                className="material-symbols-outlined text-outline-variant hover:text-on-surface text-xl"
              >
                close
              </button>
            </div>

            {loadingAnalytics || !analytics ? (
              <div className="flex flex-col items-center justify-center p-12">
                <span className="material-symbols-outlined animate-spin text-primary text-3xl">sync</span>
                <p className="text-xs text-outline mt-2">Compiling attribution matrix...</p>
              </div>
            ) : (
              <div className="space-y-6">
                <div>
                  <h4 className="font-display font-semibold text-headline-sm text-on-surface mb-1">{analytics.name}</h4>
                  <p className="text-[10px] text-outline uppercase tracking-wider">Campaign ID: {analytics.id}</p>
                </div>

                {/* Conversion Stats Indicators */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 border-y border-outline-variant/20 py-4">
                  <div className="text-center">
                    <span className="text-[9px] uppercase tracking-wider text-outline block">Dispatched</span>
                    <span className="font-display font-bold text-headline-md text-on-surface">{analytics.sentCount}</span>
                  </div>
                  <div className="text-center border-l border-outline-variant/15">
                    <span className="text-[9px] uppercase tracking-wider text-outline block">Estimated Opens</span>
                    <span className="font-display font-bold text-headline-md text-on-surface">{analytics.openRate}%</span>
                  </div>
                  <div className="text-center border-l border-outline-variant/15">
                    <span className="text-[9px] uppercase tracking-wider text-outline block">Link Clicks</span>
                    <span className="font-display font-bold text-headline-md text-on-surface">{analytics.clickRate}%</span>
                  </div>
                  <div className="text-center border-l border-outline-variant/15 bg-primary/5 rounded p-1">
                    <span className="text-[9px] uppercase tracking-wider text-primary font-semibold block">Attributed LTV</span>
                    <span className="font-display font-bold text-headline-md text-primary">₹{analytics.totalAttributedRevenue.toLocaleString('en-IN')}</span>
                  </div>
                </div>

                {/* Attributed Orders Receipts List */}
                <div className="space-y-3">
                  <h5 className="font-label-md text-xs text-on-surface font-semibold uppercase tracking-wider">Attributed Order Conversions (7-Day Window)</h5>
                  <div className="border border-outline-variant/20 rounded overflow-hidden text-[11px]">
                    <div className="bg-surface-container-low p-2 font-semibold grid grid-cols-4 border-b border-outline-variant/15 text-outline-variant">
                      <span>Order #</span>
                      <span>Customer</span>
                      <span>Date</span>
                      <th className="text-right">Total Amount</th>
                    </div>
                    {analytics.attributedOrders.length === 0 ? (
                      <p className="p-4 text-center text-outline italic">No revenue conversions attributed to this broadcast yet.</p>
                    ) : (
                      <div className="divide-y divide-outline-variant/10 max-h-40 overflow-y-auto">
                        {analytics.attributedOrders.map((ord: any) => (
                          <div key={ord.id} className="p-2 grid grid-cols-4 hover:bg-surface-container-low/20">
                            <span className="font-mono">{ord.orderNumber}</span>
                            <span>{ord.customerName}</span>
                            <span>{new Date(ord.createdAt).toLocaleDateString('en-IN')}</span>
                            <span className="text-right font-semibold text-primary">₹{ord.total.toLocaleString('en-IN')}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-end pt-4">
                  <button
                    onClick={() => setActiveAnalyticsId(null)}
                    className="px-6 py-2 bg-primary text-white rounded font-label-md text-xs uppercase tracking-wider hover:opacity-90"
                  >
                    Close Report
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
