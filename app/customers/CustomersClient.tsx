'use client';

import React, { useState, useTransition } from 'react';
import Link from 'next/link';
import { createCustomer } from './actions';

interface CustomersClientProps {
  initialCustomers: any[];
}

export default function CustomersClient({ initialCustomers }: CustomersClientProps) {
  const [isPending, startTransition] = useTransition();
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [city, setCity] = useState('');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState('');

  const handleCreateCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    startTransition(async () => {
      const res = await createCustomer({ name, mobile, email, city, notes });
      if (res.error) {
        setFormError(res.error);
      } else {
        setIsOpen(false);
        setName('');
        setMobile('');
        setEmail('');
        setCity('');
        setNotes('');
        window.location.reload();
      }
    });
  };

  // Filter based on search term
  const filteredCustomers = initialCustomers.filter((c) => {
    const term = searchTerm.toLowerCase();
    return (
      c.name.toLowerCase().includes(term) ||
      c.mobile.includes(term) ||
      (c.city && c.city.toLowerCase().includes(term))
    );
  });

  // Top VIP clients (e.g. higher lifetime spend)
  const vipClients = [...initialCustomers]
    .sort((a, b) => b.totalSpend - a.totalSpend)
    .slice(0, 3);

  return (
    <div className="flex flex-col gap-8">
      {/* Header section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 relative">
        <div className="absolute top-0 right-0 opacity-10 pointer-events-none">
          <span className="material-symbols-outlined text-9xl text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>
            local_florist
          </span>
        </div>
        <div>
          <h1 className="font-display-lg text-on-surface mb-2">Client Portfolio</h1>
          <p className="font-body-lg text-on-surface-variant">Manage and nurture your VIP relationships.</p>
        </div>
        <button
          onClick={() => setIsOpen(true)}
          className="bg-primary text-on-primary hover:opacity-90 transition-opacity px-6 py-3 rounded font-label-md flex items-center gap-2 shadow-sm hover:shadow-md self-start md:self-auto"
        >
          <span className="material-symbols-outlined text-[20px]">add</span>
          New Client
        </button>
      </div>

      {/* Top VIP Clients row */}
      {vipClients.length > 0 && (
        <section className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/20 mb-4">
          <h2 className="font-headline-md text-on-surface text-lg mb-6 border-b border-outline-variant/15 pb-2 inline-block">
            Top Valued Clients
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
            {vipClients.map((c) => {
              const initials = c.name
                .split(' ')
                .map((n: string) => n[0])
                .join('')
                .toUpperCase()
                .slice(0, 2);
              return (
                <Link
                  key={c.id}
                  href={`/customers/${c.id}`}
                  className="flex flex-col items-center group cursor-pointer text-center"
                >
                  <div className="w-20 h-20 rounded-full bg-secondary-container/30 text-primary group-hover:border-primary-container border-2 border-transparent transition-all flex items-center justify-center font-display text-xl font-bold mb-3 shadow-inner">
                    {initials}
                  </div>
                  <span className="font-label-md text-sm truncate w-full">{c.name}</span>
                  <span className="font-label-sm text-[11px] text-on-surface-variant mt-0.5">
                    LTV: ₹{c.totalSpend.toLocaleString('en-IN')}
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* CRM list view */}
      <section className="bg-surface-container-lowest rounded-xl border border-outline-variant/30 p-6">
        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-6">
          <h2 className="font-headline-md text-on-surface text-xl">Client Directory</h2>
          <div className="flex items-center gap-2 text-on-surface-variant bg-surface-container-low px-4 py-2 rounded border border-outline-variant/30">
            <span className="material-symbols-outlined text-[18px]">search</span>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search clients..."
              className="bg-transparent border-none outline-none focus:ring-0 font-body-md text-sm placeholder:text-on-surface-variant/50 w-full md:w-64"
            />
          </div>
        </div>

        <div className="flex flex-col gap-4">
          {/* Header Row (Hidden on mobile) */}
          <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-3 border-b border-outline-variant/50 font-label-sm text-[11px] text-on-surface-variant uppercase tracking-wider">
            <div className="col-span-4">Client Name</div>
            <div className="col-span-3">Contact Mobile</div>
            <div className="col-span-3">Location</div>
            <div className="col-span-2 text-right">Lifetime Spend</div>
          </div>

          {filteredCustomers.length === 0 ? (
            <div className="text-center py-10">
              <span className="material-symbols-outlined text-outline/30 text-5xl mb-2">group</span>
              <p className="font-body-md text-on-surface-variant italic">No clients registered matching search.</p>
            </div>
          ) : (
            filteredCustomers.map((c) => {
              const initials = c.name
                .split(' ')
                .map((n: string) => n[0])
                .join('')
                .toUpperCase()
                .slice(0, 2);
              return (
                <Link
                  key={c.id}
                  href={`/customers/${c.id}`}
                  className="bg-surface border border-outline-variant/20 rounded-lg p-5 md:px-6 md:py-4 hover:shadow-md transition-all cursor-pointer flex flex-col md:grid md:grid-cols-12 md:items-center gap-4"
                >
                  <div className="md:col-span-4 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-primary-container/15 text-primary-container flex items-center justify-center font-display font-semibold">
                      {initials}
                    </div>
                    <div>
                      <div className="font-headline-sm text-base text-on-surface group-hover:text-primary transition-colors">
                        {c.name}
                      </div>
                      <div className="font-body-sm text-xs text-on-surface-variant md:hidden mt-0.5">
                        LTV: ₹{c.totalSpend.toLocaleString('en-IN')}
                      </div>
                    </div>
                  </div>
                  <div className="md:col-span-3 font-body-md text-on-surface-variant">
                    {c.mobile}
                  </div>
                  <div className="md:col-span-3 font-body-md text-on-surface-variant flex items-center gap-1">
                    <span className="material-symbols-outlined text-[16px] text-outline">location_on</span>
                    {c.city || 'Not specified'}
                  </div>
                  <div className="md:col-span-2 text-right font-headline-sm text-primary hidden md:block">
                    ₹{c.totalSpend.toLocaleString('en-IN')}
                  </div>
                </Link>
              );
            })
          )}
        </div>
      </section>

      {/* Add Client Dialog Modal */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-8 max-w-md w-full shadow-2xl relative">
            <h3 className="font-display font-semibold text-headline-sm text-on-surface mb-6">
              Create VIP Client Profile
            </h3>

            <form onSubmit={handleCreateCustomer} className="flex flex-col gap-5">
              {/* Name */}
              <div className="flex flex-col gap-1">
                <label className="font-label-md text-xs text-on-surface-variant uppercase">Full Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Eleanor Vance"
                  className="w-full bg-transparent border-0 border-b border-outline-variant focus:border-primary focus:ring-0 py-2 font-body-md"
                />
              </div>

              {/* Mobile */}
              <div className="flex flex-col gap-1 mt-2">
                <label className="font-label-md text-xs text-on-surface-variant uppercase">Mobile Phone Number *</label>
                <input
                  type="text"
                  required
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  placeholder="E.g. 9876543210"
                  className="w-full bg-transparent border-0 border-b border-outline-variant focus:border-primary focus:ring-0 py-2 font-body-md"
                />
              </div>

              {/* Email */}
              <div className="flex flex-col gap-1 mt-2">
                <label className="font-label-md text-xs text-on-surface-variant uppercase">Email Address (Optional)</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="eleanor@vance.com"
                  className="w-full bg-transparent border-0 border-b border-outline-variant focus:border-primary focus:ring-0 py-2 font-body-md"
                />
              </div>

              {/* City */}
              <div className="flex flex-col gap-1 mt-2">
                <label className="font-label-md text-xs text-on-surface-variant uppercase">Location/City (Optional)</label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="E.g. Mumbai"
                  className="w-full bg-transparent border-0 border-b border-outline-variant focus:border-primary focus:ring-0 py-2 font-body-md"
                />
              </div>

              {/* Notes */}
              <div className="flex flex-col gap-1 mt-2">
                <label className="font-label-md text-xs text-on-surface-variant uppercase">Internal Profile Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="E.g. Prefers silk embroidery and pastel hues..."
                  className="w-full bg-transparent border-0 border-b border-outline-variant focus:border-primary focus:ring-0 py-2 font-body-md resize-none"
                />
              </div>

              {formError && (
                <div className="text-error font-body-md text-xs bg-error-container/20 p-2 rounded">
                  {formError}
                </div>
              )}

              <div className="flex justify-end gap-4 mt-6 pt-4 border-t border-outline-variant/10">
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    setFormError('');
                  }}
                  className="px-4 py-2 border border-outline text-on-surface rounded font-label-sm uppercase tracking-wider text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-2 bg-primary text-on-primary rounded font-label-sm uppercase tracking-wider text-xs hover:opacity-90 disabled:opacity-50"
                >
                  {isPending ? 'Saving...' : 'Create Client'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
