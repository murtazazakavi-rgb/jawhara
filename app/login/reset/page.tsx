'use client';

import React, { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { requestPasswordResetAction, resetPasswordWithCodeAction } from './actions';

const RESEND_SECONDS = 60;

const inputClass =
  'w-full bg-transparent border-b border-outline-variant/50 focus:border-primary py-2 outline-none text-base transition-colors';
const labelClass = 'font-label-md text-xs text-on-surface-variant uppercase';

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirect') || '/account';

  const [step, setStep] = useState<'request' | 'verify'>('request');
  const [identifier, setIdentifier] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  const sendCode = async () => {
    setError('');
    setLoading(true);
    try {
      const res = await requestPasswordResetAction({ identifier });
      if (res.error) {
        setError(res.error);
        return;
      }
      setStep('verify');
      setCode('');
      setResendIn(RESEND_SECONDS);
    } catch (err) {
      console.error(err);
      setError('Could not send a code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    await sendCode();
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const res = await resetPasswordWithCodeAction({ identifier, code, newPassword });
      if (res.error) {
        setError(res.error);
        if (res.expired) setResendIn(0);
        return;
      }
      router.push(redirectTo);
      router.refresh();
    } catch (err) {
      console.error(err);
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-surface text-on-surface min-h-screen font-body-md flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-6 sm:p-8 shadow-lg">
        <div className="text-center mb-8">
          <span className="font-display font-semibold text-2xl tracking-widest uppercase text-primary">Jawhara</span>
          <h1 className="font-display text-xl text-on-surface mt-4">Reset your password</h1>
          <p className="text-sm text-on-surface-variant mt-2">
            {step === 'request'
              ? 'Enter the email or mobile number on your account. We’ll send a 6-digit code to your WhatsApp.'
              : 'If an account matches, we’ve sent a code to the WhatsApp number on it. Enter it below with your new password.'}
          </p>
        </div>

        {error && (
          <p role="alert" className="bg-error/10 border border-error/20 text-error text-sm p-3 rounded-lg mb-5">
            {error}
          </p>
        )}

        {step === 'request' ? (
          <form onSubmit={handleRequest} className="space-y-6">
            <div className="flex flex-col gap-2">
              <label htmlFor="reset-identifier" className={labelClass}>Email or mobile number</label>
              <input
                id="reset-identifier"
                type="text"
                inputMode="email"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                required
                placeholder="jane@example.com or 98765 43210"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className={inputClass}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 bg-primary text-on-primary text-sm font-semibold rounded-xl hover:opacity-95 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? 'Sending…' : 'Send code on WhatsApp'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleReset} className="space-y-5">
            <div className="flex flex-col gap-2">
              <label htmlFor="reset-code" className={labelClass}>6-digit code</label>
              <input
                id="reset-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="\d{6}"
                maxLength={6}
                required
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                className={`${inputClass} tracking-[0.5em] font-mono`}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="reset-new" className={labelClass}>New password</label>
              <input
                id="reset-new"
                type="password"
                autoComplete="new-password"
                minLength={6}
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className={inputClass}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="reset-confirm" className={labelClass}>Confirm new password</label>
              <input
                id="reset-confirm"
                type="password"
                autoComplete="new-password"
                minLength={6}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={inputClass}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 bg-primary text-on-primary text-sm font-semibold rounded-xl hover:opacity-95 disabled:opacity-50 cursor-pointer"
            >
              {loading ? 'Saving…' : 'Set new password & sign in'}
            </button>
            <div className="flex items-center justify-between text-sm">
              <button
                type="button"
                onClick={() => {
                  setStep('request');
                  setError('');
                }}
                className="text-on-surface-variant hover:text-primary cursor-pointer"
              >
                Change email/number
              </button>
              <button
                type="button"
                onClick={sendCode}
                disabled={loading || resendIn > 0}
                className="text-primary font-semibold disabled:text-outline cursor-pointer"
              >
                {resendIn > 0 ? `Resend in ${resendIn}s` : 'Resend code'}
              </button>
            </div>
          </form>
        )}

        <p className="text-center text-sm text-on-surface-variant mt-8">
          Remembered it?{' '}
          <Link
            href={`/login${redirectTo !== '/account' ? `?redirect=${encodeURIComponent(redirectTo)}` : ''}`}
            className="text-primary font-semibold"
          >
            Back to sign in
          </Link>
        </p>
        <p className="text-center text-xs text-outline mt-3">
          No WhatsApp number on your account? Message the boutique and we’ll help you in.
        </p>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordContent />
    </Suspense>
  );
}
