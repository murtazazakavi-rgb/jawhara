'use client';

import React, { useState, useEffect, useRef } from 'react';

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);

  useEffect(() => {
    // 1. Skip if already in standalone (installed) mode
    if (typeof window !== 'undefined') {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone;
      if (isStandalone) return;

      // 2. Check if iOS Safari
      const ua = navigator.userAgent;
      const isAppleMobile = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
      const isSafari = ua.includes('Safari') && !ua.includes('CriOS') && !ua.includes('FxiOS');
      
      if (isAppleMobile && isSafari) {
        setIsIos(true);
        // Show iOS install reminder if they haven't dismissed it in this session
        const dismissed = sessionStorage.getItem('jawhara_ios_prompt_dismissed');
        if (!dismissed) {
          setShowPrompt(true);
        }
      }

      // 3. Listen for Android/Chrome beforeinstallprompt event
      const handleBeforeInstallPrompt = (e: Event) => {
        e.preventDefault();
        setDeferredPrompt(e);
        const dismissed = sessionStorage.getItem('jawhara_android_prompt_dismissed');
        if (!dismissed) {
          setShowPrompt(true);
        }
      };

      window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

      return () => {
        window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      };
    }
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log(`PWA install prompt outcome: ${outcome}`);
      setDeferredPrompt(null);
      setShowPrompt(false);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    if (isIos) {
      sessionStorage.setItem('jawhara_ios_prompt_dismissed', 'true');
    } else {
      sessionStorage.setItem('jawhara_android_prompt_dismissed', 'true');
    }
  };

  if (!showPrompt) return null;

  return (
    <>
      {/* Installation Banner */}
      <div className="fixed top-4 left-4 right-4 bg-[#755566] text-white p-4 rounded-xl shadow-xl z-50 flex items-center justify-between gap-4 max-w-md mx-auto border border-[#755566]/20 font-body-md animate-pwa-slide-down">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-[28px] bg-white/10 p-1.5 rounded-lg">
            install_mobile
          </span>
          <div className="text-left">
            <h4 className="font-semibold text-xs text-white">Add Jawhara to Home Screen</h4>
            <p className="text-[10.5px] opacity-85 leading-tight mt-0.5">Install the standalone app for quick access & alerts</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {isIos ? (
            <button
              onClick={() => setShowIosGuide(true)}
              className="bg-white text-[#755566] font-semibold text-[10.5px] uppercase px-3 py-1.5 rounded-full hover:bg-white/95 transition-colors cursor-pointer whitespace-nowrap"
            >
              Install
            </button>
          ) : (
            <button
              onClick={handleInstallClick}
              className="bg-white text-[#755566] font-semibold text-[10.5px] uppercase px-3 py-1.5 rounded-full hover:bg-white/95 transition-colors cursor-pointer whitespace-nowrap"
            >
              Install
            </button>
          )}
          <button
            onClick={handleDismiss}
            className="text-white/60 hover:text-white p-1"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
      </div>

      {/* iOS Share Sheet Guide Modal */}
      {showIosGuide && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-4 z-[999] font-body-md">
          <div className="bg-surface rounded-t-2xl sm:rounded-2xl p-6 w-full max-w-sm border border-outline-variant/30 text-center space-y-4 shadow-xl animate-pwa-modal-fade">
            <div className="flex justify-between items-center pb-2 border-b border-outline-variant/20">
              <span className="font-semibold text-sm text-on-surface">Install on iOS Device</span>
              <button 
                onClick={() => setShowIosGuide(false)}
                className="text-on-surface-variant hover:text-primary"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>
            
            <p className="text-xs text-on-surface-variant leading-relaxed text-left">
              Safari on iOS does not support programmatic one-click installs. Follow these quick steps to add Maison Jawhara to your home screen:
            </p>

            <div className="space-y-3.5 text-left py-2 text-xs text-on-surface">
              <div className="flex items-start gap-2.5">
                <span className="bg-primary-container text-primary font-bold text-[10px] w-5 h-5 rounded-full flex items-center justify-center shrink-0">1</span>
                <div>Tap the <strong className="text-primary font-semibold">Share</strong> button at the bottom of Safari (<span className="material-symbols-outlined text-sm align-middle">ios_share</span>).</div>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="bg-primary-container text-primary font-bold text-[10px] w-5 h-5 rounded-full flex items-center justify-center shrink-0">2</span>
                <div>Scroll down the list of options and select <strong className="text-primary font-semibold">Add to Home Screen</strong> (<span className="material-symbols-outlined text-sm align-middle">add_box</span>).</div>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="bg-primary-container text-primary font-bold text-[10px] w-5 h-5 rounded-full flex items-center justify-center shrink-0">3</span>
                <div>Confirm the name and click <strong className="text-primary font-semibold">Add</strong> in the top right corner.</div>
              </div>
            </div>

            <button
              onClick={() => {
                setShowIosGuide(false);
                setShowPrompt(false);
                sessionStorage.setItem('jawhara_ios_prompt_dismissed', 'true');
              }}
              className="w-full bg-[#755566] text-white font-semibold text-xs py-2.5 rounded-full hover:opacity-95 transition-opacity cursor-pointer uppercase tracking-wider"
            >
              Got it
            </button>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes pwaSlideDown {
          from { transform: translateY(-3rem); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes pwaModalFade {
          from { transform: scale(0.95); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        .animate-pwa-slide-down {
          animation: pwaSlideDown 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .animate-pwa-modal-fade {
          animation: pwaModalFade 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      ` }} />
    </>
  );
}
