'use client';

import React, { useActionState, useState } from 'react';
import { useRouter } from 'next/navigation';
import { login } from './actions';

export default function LoginPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);

  const [state, formAction, isPending] = useActionState<
    { error?: string; success?: boolean },
    FormData
  >(
    async (prevState, formData) => {
      const res = await login(prevState, formData);
      if (res.success) {
        router.push('/');
        router.refresh();
        return { success: true };
      }
      return { error: res.error };
    },
    { error: undefined, success: undefined }
  );

  return (
    <div className="bg-surface text-on-surface font-body-md min-h-screen flex flex-col relative overflow-hidden">
      {/* Decorative Background */}
      <div className="absolute inset-0 z-0 pointer-events-none opacity-5 flex items-center justify-center">
        <img
          alt="Rose background watermark"
          className="w-[800px] h-auto object-contain rose-watermark max-w-none"
          src="https://lh3.googleusercontent.com/aida-public/AB6AXuAhdq0dXJri4MFH3Wt2uKtyWtspVpIQ2z53D8Cnn7X8tVfQ8ugNxIuYzv1c6X9KzAhUpV7v9p96gA8TwFVDizB-9vje9yNRpNlZUapWuVHEOel4fDqwRLP6htVraQFPYPnckeGH_TXyuemSckNEh1Xq65Yn1RVGy93diDX4ADxCXVA6WHQmlTmGqFbxWNncM516g-TiJEG9EqtHdu8yLbWp2rM8vd5r0lmcUR-L4-rbqANsG-kGcQJ6lxDkjE5RBpbzP5U"
        />
      </div>

      {/* Main Content Area */}
      <main className="flex-grow flex flex-col items-center justify-center z-10 px-margin-mobile md:px-margin-desktop py-12 md:py-20 relative">
        {/* Brand Header */}
        <header className="text-center mb-12 flex flex-col items-center w-full max-w-md">
          <div className="mb-4">
            <span className="font-display-lg text-primary tracking-widest uppercase text-5xl">
              Jawhara
            </span>
          </div>
          <h1 className="font-headline-sm text-primary-container tracking-wider uppercase opacity-80">
            Where Every Thing Pretty Lives
          </h1>
        </header>

        {/* Login Card */}
        <section className="bg-surface-container-lowest w-full max-w-md rounded-xl p-8 md:p-10 border border-outline-variant/30 shadow-[0_4px_40px_rgba(117,85,102,0.03)] flex flex-col gap-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-secondary-container/20 rounded-bl-full -mr-4 -mt-4 z-0"></div>
          
          <div className="text-center z-10 mb-2">
            <h2 className="font-headline-md text-on-surface mb-2">Access Portal</h2>
            <p className="font-body-md text-on-surface-variant">Please sign in to continue.</p>
          </div>

          <form action={formAction} className="flex flex-col gap-5 z-10 w-full">
            {/* Username Field */}
            <div className="flex flex-col gap-1 w-full">
              <label className="font-label-md text-on-surface uppercase" htmlFor="username">
                Username or Email
              </label>
              <div className="relative w-full">
                <span className="material-symbols-outlined absolute left-0 bottom-3 text-outline text-[20px]">
                  person
                </span>
                <input
                  className="w-full bg-transparent border-0 border-b border-outline-variant focus:border-primary focus:ring-0 px-8 py-2 font-body-md text-on-surface transition-colors placeholder:text-outline/50"
                  id="username"
                  name="username"
                  placeholder="Enter your credentials"
                  required
                  type="text"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="flex flex-col gap-1 w-full mt-2">
              <div className="flex justify-between items-center w-full">
                <label className="font-label-md text-on-surface uppercase" htmlFor="password">
                  Password
                </label>
                <a
                  className="font-label-sm text-primary hover:text-primary-container transition-colors"
                  href="#"
                  onClick={(e) => e.preventDefault()}
                >
                  Forgot password?
                </a>
              </div>
              <div className="relative w-full">
                <span className="material-symbols-outlined absolute left-0 bottom-3 text-outline text-[20px]">
                  lock
                </span>
                <input
                  className="w-full bg-transparent border-0 border-b border-outline-variant focus:border-primary focus:ring-0 px-8 py-2 font-body-md text-on-surface transition-colors placeholder:text-outline/50"
                  id="password"
                  name="password"
                  placeholder="••••••••"
                  required
                  type={showPassword ? 'text' : 'password'}
                />
                <button
                  className="absolute right-2 bottom-2.5 text-outline hover:text-on-surface transition-colors focus:outline-none"
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  <span className="material-symbols-outlined text-[20px]">
                    {showPassword ? 'visibility' : 'visibility_off'}
                  </span>
                </button>
              </div>
            </div>

            {state?.error && (
              <div className="text-error font-body-md text-sm mt-2 text-center bg-error-container/20 p-2 rounded">
                {state.error}
              </div>
            )}

            {/* Submit Button */}
            <button
              className="w-full mt-6 bg-primary text-on-primary font-label-md uppercase tracking-wider py-4 rounded hover:opacity-90 active:scale-[0.98] transition-all duration-200 shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
              type="submit"
              disabled={isPending}
            >
              {isPending ? 'Signing In...' : 'Sign In'}
              <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </button>
          </form>

          <div className="mt-4 pt-6 border-t border-outline-variant/20 flex flex-col items-center justify-center gap-2 z-10 w-full">
            <p className="font-body-sm text-[13px] text-on-surface-variant text-center">
              Authorized personnel only.
            </p>
            <div className="text-center mt-3 pt-3 border-t border-outline-variant/10 w-full flex flex-col items-center">
              <span className="font-body-sm text-[11px] text-on-surface-variant/80 mb-1">
                Are you a boutique customer?
              </span>
              <a
                href="/shop/login"
                className="text-primary hover:underline text-xs font-label-md uppercase tracking-wider font-semibold cursor-pointer"
              >
                Go to Customer Portal & Sign Up
              </a>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="w-full py-6 text-center z-10 flex flex-col items-center justify-center relative">
        <div className="flex items-center gap-2 text-outline">
          <span className="material-symbols-outlined text-[16px]">verified_user</span>
          <span className="font-label-sm uppercase tracking-widest">JAWHARA OS</span>
        </div>
      </footer>
    </div>
  );
}
