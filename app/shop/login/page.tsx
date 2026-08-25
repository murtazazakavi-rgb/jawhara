'use client';

import React, { useState } from 'react';
import { sendOtpAction, verifyOtpAction } from '../actions';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function ShopLoginPage() {
  const router = useRouter();
  
  // States
  const [mobile, setMobile] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [city, setCity] = useState('');
  const [code, setCode] = useState('');
  
  const [step, setStep] = useState<1 | 2>(1);
  const [isNewCustomer, setIsNewCustomer] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await sendOtpAction({
        mobile,
        firstName: isNewCustomer ? firstName : undefined,
        lastName: isNewCustomer ? lastName : undefined,
      });

      if (res.error) {
        if (res.isNewCustomer) {
          setIsNewCustomer(true);
          setError('First time registering? Please provide your first and last name to proceed.');
        } else {
          setError(res.error);
        }
      } else {
        setSuccessMsg('OTP Code has been sent to your WhatsApp number!');
        setStep(2);
      }
    } catch (err) {
      console.error(err);
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await verifyOtpAction({
        mobile,
        code,
        firstName: isNewCustomer ? firstName : undefined,
        lastName: isNewCustomer ? lastName : undefined,
        email: email.trim() || undefined,
        city: city.trim() || undefined,
      });

      if (res.error) {
        setError(res.error);
      } else {
        router.push('/shop');
        router.refresh();
      }
    } catch (err) {
      console.error(err);
      setError('Failed to verify OTP code.');
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
            {step === 1 ? 'Client Access Portal' : 'Enter Verification Code'}
          </h1>
          <p className="font-body-sm text-xs text-on-surface-variant/80 mt-1">
            {step === 1 
              ? 'Provide your WhatsApp mobile number to enter the catalog lookup.' 
              : `A 6-digit OTP code has been dispatched to ${mobile}`}
          </p>
        </div>

        {error && (
          <div className="bg-error/10 border border-error/20 text-error text-xs p-3 rounded-lg mb-6 leading-relaxed">
            {error}
          </div>
        )}

        {successMsg && !error && (
          <div className="bg-success/15 border border-success/30 text-success text-xs p-3 rounded-lg mb-6">
            {successMsg}
          </div>
        )}

        {step === 1 ? (
          <form onSubmit={handleSendOtp} className="space-y-5">
            <div className="flex flex-col gap-2">
              <label className="font-label-md text-xs text-on-surface-variant uppercase">
                WhatsApp Mobile Number
              </label>
              <input
                type="tel"
                required
                placeholder="e.g. +91 9876543210"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                className="bg-transparent border-b border-outline-variant/50 focus:border-primary py-2.5 outline-none font-body-md text-body-md transition-colors"
              />
            </div>

            {isNewCustomer && (
              <div className="space-y-4 pt-2 border-t border-outline-variant/10 animate-fade-in">
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-2">
                    <label className="font-label-md text-xs text-on-surface-variant uppercase">First Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="Jane"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="bg-transparent border-b border-outline-variant/50 focus:border-primary py-2 outline-none font-body-md text-body-md text-xs"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="font-label-md text-xs text-on-surface-variant uppercase">Last Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="Doe"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="bg-transparent border-b border-outline-variant/50 focus:border-primary py-2 outline-none font-body-md text-body-md text-xs"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="font-label-md text-xs text-on-surface-variant uppercase">Email (Optional)</label>
                  <input
                    type="email"
                    placeholder="jane@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="bg-transparent border-b border-outline-variant/50 focus:border-primary py-2 outline-none font-body-md text-body-md text-xs"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="font-label-md text-xs text-on-surface-variant uppercase">City (Optional)</label>
                  <input
                    type="text"
                    placeholder="Mumbai"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="bg-transparent border-b border-outline-variant/50 focus:border-primary py-2 outline-none font-body-md text-body-md text-xs"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-white font-label-md text-sm py-3 rounded-xl hover:opacity-95 transition-opacity mt-4 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loading ? 'Sending Request...' : 'Request OTP Code'}
              <span className="material-symbols-outlined text-sm">chat</span>
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="space-y-6">
            <div className="flex flex-col gap-2">
              <label className="font-label-md text-xs text-on-surface-variant uppercase">
                6-Digit Verification Code
              </label>
              <input
                type="text"
                required
                maxLength={6}
                placeholder="000000"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="bg-transparent border-b border-outline-variant/50 focus:border-primary py-2.5 outline-none font-mono text-center text-xl tracking-[0.5em] transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-white font-label-md text-sm py-3 rounded-xl hover:opacity-95 transition-opacity flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loading ? 'Verifying...' : 'Verify & Continue'}
              <span className="material-symbols-outlined text-sm">login</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setError('');
                setStep(1);
                setCode('');
              }}
              className="w-full border border-outline-variant text-on-surface-variant hover:bg-surface-container-low py-3 rounded-xl font-label-md text-sm cursor-pointer transition-colors"
            >
              Back to Number Entry
            </button>
          </form>
        )}

        <div className="mt-8 text-center border-t border-outline-variant/10 pt-4">
          <Link href="/shop" className="text-primary hover:underline text-xs font-label-md uppercase tracking-wider">
            Browse Catalog as Guest
          </Link>
        </div>
      </div>
    </div>
  );
}
