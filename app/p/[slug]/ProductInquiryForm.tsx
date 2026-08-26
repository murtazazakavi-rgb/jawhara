'use client';

import React, { useState, useTransition } from 'react';
import Link from 'next/link';
import { clientSendMessageAction } from '../../shop/actions';

interface ProductInquiryFormProps {
  productId: string;
  isLoggedIn: boolean;
}

export default function ProductInquiryForm({ productId, isLoggedIn }: ProductInquiryFormProps) {
  const [body, setBody] = useState('');
  const [isPending, startTransition] = useTransition();
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;

    setError('');
    setSuccess(false);

    startTransition(async () => {
      try {
        const res = await clientSendMessageAction({ productId, body });
        if (res.error) {
          setError(res.error);
        } else {
          setSuccess(true);
          setBody('');
        }
      } catch (err) {
        console.error(err);
        setError('Failed to send message.');
      }
    });
  };

  if (!isLoggedIn) {
    return (
      <div className="bg-surface-container/50 border border-outline-variant/30 rounded-xl p-5 text-center mt-6">
        <span className="material-symbols-outlined text-outline/50 text-3xl mb-1.5">login</span>
        <p className="font-body-md text-on-surface-variant text-sm mb-3">
          To chat directly with our boutique assistant about this piece:
        </p>
        <Link
          href="/login"
          className="inline-block bg-primary-container text-on-primary-container hover:opacity-90 font-label-md text-xs uppercase tracking-wider px-5 py-2 rounded-lg transition-opacity"
        >
          Sign In to Portal
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-5 md:p-6 shadow-sm mt-6">
      <h3 className="font-display font-medium text-sm text-primary uppercase tracking-wider border-b border-outline-variant/15 pb-2 mb-4 flex items-center gap-1.5">
        <span className="material-symbols-outlined text-base">forum</span>
        Ask the Boutique
      </h3>

      {error && (
        <div className="bg-error/10 border border-error/20 text-error text-xs p-3 rounded-lg mb-4">
          {error}
        </div>
      )}

      {success ? (
        <div className="bg-success/10 border border-success/20 text-success text-xs p-3 rounded-lg mb-4 leading-relaxed">
          <strong>Inquiry Sent!</strong> Your message has been routed to our assistant. You can check for replies on your{' '}
          <Link href="/dashboard" className="underline font-bold hover:text-success/80">
            Lookbook Dashboard
          </Link>.
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex flex-col gap-1.5">
          <textarea
            required
            rows={3}
            placeholder="Type your question about this design..."
            value={body}
            onChange={(e) => setBody(e.target.value)}
            disabled={isPending}
            className="w-full bg-transparent border border-outline-variant/50 focus:border-primary rounded-lg p-2.5 outline-none font-body-md text-sm transition-colors resize-none"
          />
        </div>

        <button
          type="submit"
          disabled={isPending || !body.trim()}
          className="w-full bg-primary text-white font-label-md text-xs py-3 rounded-lg hover:opacity-90 transition-opacity flex justify-center items-center gap-1.5 cursor-pointer disabled:opacity-50"
        >
          {isPending ? 'Sending inquiry...' : 'Send Message'}
          <span className="material-symbols-outlined text-sm">send</span>
        </button>
      </form>
    </div>
  );
}
