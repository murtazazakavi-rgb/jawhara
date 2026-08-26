'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface HoldTimerBadgeProps {
  expiresAt: string | null | undefined;
}

export default function HoldTimerBadge({ expiresAt }: HoldTimerBadgeProps) {
  const router = useRouter();
  const [timeText, setTimeText] = useState('Reserved');
  const [hasRefreshed, setHasRefreshed] = useState(false);

  useEffect(() => {
    if (!expiresAt) return;

    const update = () => {
      const diff = new Date(expiresAt).getTime() - Date.now();
      if (diff <= 0) {
        setTimeText('Hold expired / Reloading...');
        if (!hasRefreshed) {
          setHasRefreshed(true);
          router.refresh();
        }
      } else {
        const mins = Math.floor(diff / 60000);
        const secs = Math.floor((diff % 60000) / 1000);
        setTimeText(`${mins}m ${secs}s remaining`);
      }
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [expiresAt, hasRefreshed, router]);

  if (!expiresAt) return null;

  return (
    <div className="bg-error/10 border border-error/20 text-error rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-sm mt-4 font-semibold">
      <div className="flex items-center gap-2">
        <span className="material-symbols-outlined text-base text-error">schedule</span>
        <span>This unique piece is temporarily on hold for another customer.</span>
      </div>
      <div className="shrink-0 bg-error text-white text-xs px-3 py-1 rounded-full uppercase tracking-wider font-bold">
        {timeText}
      </div>
    </div>
  );
}
