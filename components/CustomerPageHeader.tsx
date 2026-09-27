import React from 'react';
import Link from 'next/link';

/** Sticky header shared by the customer's My Holds and Account pages. */
export default function CustomerPageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="w-full py-4 border-b border-outline-variant/20 bg-surface-container-lowest z-10 sticky top-0 shadow-sm">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 flex items-center gap-3">
        <Link
          href="/"
          className="w-10 h-10 -ml-2 flex items-center justify-center rounded-full text-primary hover:bg-primary/5 transition-colors shrink-0"
          aria-label="Back to shop"
        >
          <span className="material-symbols-outlined">arrow_back</span>
        </Link>
        <div className="min-w-0">
          <h1 className="font-display text-xl text-primary leading-tight">{title}</h1>
          {subtitle && <p className="text-sm text-on-surface-variant truncate">{subtitle}</p>}
        </div>
      </div>
    </header>
  );
}
