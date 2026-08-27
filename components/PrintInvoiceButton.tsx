'use client';

import React from 'react';

export default function PrintInvoiceButton() {
  return (
    <button
      onClick={() => window.print()}
      className="px-4 py-2 bg-primary text-white text-xs font-label-md uppercase tracking-wider rounded-lg flex items-center gap-1.5 hover:opacity-90 transition-opacity cursor-pointer animate-fade-in"
    >
      <span className="material-symbols-outlined text-sm">print</span>
      Print Invoice
    </button>
  );
}
