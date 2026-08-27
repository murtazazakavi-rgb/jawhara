'use client';

import React, { useState, Suspense } from 'react';
import { clientLoginAction, clientRegisterAndLoginAction } from '../shop/actions';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import PhoneInput from '@/components/PhoneInput';

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirect') || '/';
  
  // Views: 'login' | 'register'
  const [view, setView] = useState<'login' | 'register'>('login');

  // Login states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // Registration states
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [mobile, setMobile] = useState('');
  const [city, setCity] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await clientLoginAction({ email, password });
      if (res.error) {
        setError(res.error);
      } else {
        router.push(redirectTo);
        router.refresh();
      }
    } catch (err) {
      console.error(err);
      setError('An unexpected login error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!firstName.trim() || !lastName.trim() || !mobile.trim()) {
      setError('First Name, Last Name, and Mobile Number are required for registration.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const res = await clientRegisterAndLoginAction({
        email,
        password,
        firstName,
        lastName,
        mobile,
        city: city.trim() || undefined,
      });

      if (res.error) {
        setError(res.error);
      } else {
        router.push(redirectTo);
        router.refresh();
      }
    } catch (err) {
      console.error(err);
      setError('Failed to create customer account.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-surface text-on-surface min-h-screen font-body-md flex items-center justify-center p-4 relative overflow-hidden">
      {/* Decorative rose watermark */}
      <div className="absolute inset-0 rose-watermark opacity-[0.02] pointer-events-none z-0"></div>

      <div className="max-w-md w-full bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-6 sm:p-8 shadow-lg relative z-10">
        
        {/* Header Logo */}
        <div className="text-center mb-8">
          <span className="font-display font-semibold text-2xl tracking-widest uppercase text-primary">
            JAWHARA
          </span>
          <p className="text-[10px] font-label-sm uppercase tracking-widest text-outline -mt-1">
            Where Every Thing Pretty Lives
          </p>
          <h1 className="font-display text-lg text-on-surface mt-6 font-semibold">
            {view === 'login' ? 'Client Access Portal' : 'Create Customer Profile'}
          </h1>
          <p className="font-body-sm text-xs text-on-surface-variant/80 mt-1">
            {view === 'login' 
              ? 'Log in using your registered email and password.' 
              : 'Complete your registration. Phone and name details are mandatory.'}
          </p>
        </div>

        {error && (
          <div className="bg-error/10 border border-error/20 text-error text-xs p-3 rounded-lg mb-6 leading-relaxed">
            {error}
          </div>
        )}

        {view === 'login' ? (
          <form onSubmit={handleLogin} className="space-y-5">
            <div className="flex flex-col gap-2">
              <label className="font-label-md text-xs text-on-surface-variant uppercase">
                Email Address
              </label>
              <input
                type="email"
                required
                placeholder="jane@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-transparent border-b border-outline-variant/50 focus:border-primary py-2 outline-none font-body-md text-body-md transition-colors"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="font-label-md text-xs text-on-surface-variant uppercase flex justify-between">
                <span>Password</span>
                <span className="text-[10px] lowercase text-outline normal-case tracking-normal">
                  (Default: 123456)
                </span>
              </label>
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-transparent border-b border-outline-variant/50 focus:border-primary py-2 outline-none font-body-md text-body-md transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-white font-label-md text-sm py-3 rounded-xl hover:opacity-95 transition-opacity mt-4 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loading ? 'Signing in...' : 'Sign In'}
              <span className="material-symbols-outlined text-sm">login</span>
            </button>
          </form>
        ) : (
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="flex flex-col gap-1.5">
              <label className="font-label-md text-xs text-on-surface-variant uppercase">Email Address *</label>
              <input
                type="email"
                required
                placeholder="jane@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-transparent border-b border-outline-variant/50 focus:border-primary py-1.5 outline-none font-body-md text-sm transition-colors"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="font-label-md text-xs text-on-surface-variant uppercase">First Name *</label>
                <input
                  type="text"
                  required
                  placeholder="Jane"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="bg-transparent border-b border-outline-variant/50 focus:border-primary py-1.5 outline-none font-body-md text-sm transition-colors"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="font-label-md text-xs text-on-surface-variant uppercase">Last Name *</label>
                <input
                  type="text"
                  required
                  placeholder="Doe"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="bg-transparent border-b border-outline-variant/50 focus:border-primary py-1.5 outline-none font-body-md text-sm transition-colors"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-label-md text-xs text-on-surface-variant uppercase">Mobile Phone Number *</label>
              <PhoneInput
                value={mobile}
                onChange={setMobile}
                required
                className="mt-1"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-label-md text-xs text-on-surface-variant uppercase">City (Optional)</label>
              <input
                type="text"
                placeholder="Mumbai"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="bg-transparent border-b border-outline-variant/50 focus:border-primary py-1.5 outline-none font-body-md text-sm transition-colors"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="font-label-md text-xs text-on-surface-variant uppercase">Password *</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-transparent border-b border-outline-variant/50 focus:border-primary py-1.5 outline-none font-body-md text-sm transition-colors"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="font-label-md text-xs text-on-surface-variant uppercase">Confirm Password *</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="bg-transparent border-b border-outline-variant/50 focus:border-primary py-1.5 outline-none font-body-md text-sm transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-white font-label-md text-sm py-3 rounded-xl hover:opacity-95 transition-opacity mt-4 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loading ? 'Creating Profile...' : 'Complete Signup & Enter'}
              <span className="material-symbols-outlined text-sm">person_add</span>
            </button>
          </form>
        )}

        <div className="mt-8 text-center border-t border-outline-variant/10 pt-4 flex flex-col gap-2">
          {view === 'login' ? (
            <button
              onClick={() => {
                setError('');
                setView('register');
              }}
              className="text-primary hover:underline text-xs font-label-md uppercase tracking-wider cursor-pointer"
            >
              New client? Register here
            </button>
          ) : (
            <button
              onClick={() => {
                setError('');
                setView('login');
              }}
              className="text-primary hover:underline text-xs font-label-md uppercase tracking-wider cursor-pointer"
            >
              Already registered? Sign in
            </button>
          )}
          <Link href="/" className="text-outline hover:underline text-[10px] font-label-md uppercase tracking-wider mt-2">
            Browse Catalog as Guest
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function ShopLoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-surface flex items-center justify-center text-outline">Loading...</div>}>
      <LoginPageContent />
    </Suspense>
  );
}
