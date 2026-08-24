'use client';

import React, { useState } from 'react';
import { saveSystemSetting } from '../settings/actions';

interface Setting {
  key: string;
  value: string;
}

interface AutomationsClientProps {
  initialSettings: Setting[];
}

export default function AutomationsClient({ initialSettings }: AutomationsClientProps) {
  const [settings, setSettings] = useState<Setting[]>(initialSettings);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const getSettingVal = (key: string, defaultValue: string) => {
    return settings.find(s => s.key === key)?.value || defaultValue;
  };

  const handleToggle = async (key: string, currentValue: string) => {
    const nextVal = currentValue === 'true' ? 'false' : 'true';
    setSavingKey(key);

    try {
      const res = await saveSystemSetting(key, nextVal);
      if (res.error) {
        alert(res.error);
      } else {
        setSettings(prev => {
          const index = prev.findIndex(s => s.key === key);
          if (index > -1) {
            const updated = [...prev];
            updated[index] = { key, value: nextVal };
            return updated;
          }
          return [...prev, { key, value: nextVal }];
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSavingKey(null);
    }
  };

  const isWaEnabled = getSettingVal('enableWhatsAppAutomation', 'true') === 'true';
  const isResponderEnabled = getSettingVal('enableAutoProductResponder', 'true') === 'true';

  return (
    <div className="space-y-6">
      <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-6 md:p-8 shadow-sm">
        <h2 className="font-display font-medium text-headline-sm text-primary border-b border-outline-variant/20 pb-4 mb-6">
          Global Trigger Controls
        </h2>

        <div className="space-y-6">
          {/* Toggle WhatsApp Automation */}
          <div className="flex items-start justify-between gap-4 p-4 border border-outline-variant/20 rounded-lg hover:bg-surface-container-low/20 transition-all">
            <div className="space-y-1">
              <h3 className="font-label-md text-sm text-on-surface font-semibold flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[20px]">chat</span>
                WhatsApp Customer Notifications
              </h3>
              <p className="text-xs text-outline-variant max-w-lg">
                Automatically send confirmation templates or text alerts on WhatsApp when orders are paid, reserved, or shipped.
              </p>
            </div>
            <button
              onClick={() => handleToggle('enableWhatsAppAutomation', isWaEnabled ? 'true' : 'false')}
              disabled={savingKey === 'enableWhatsAppAutomation'}
              className={`w-12 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${
                isWaEnabled ? 'bg-primary' : 'bg-outline-variant'
              } disabled:opacity-50`}
            >
              <div
                className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${
                  isWaEnabled ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Toggle Auto Product Responder */}
          <div className="flex items-start justify-between gap-4 p-4 border border-outline-variant/20 rounded-lg hover:bg-surface-container-low/20 transition-all">
            <div className="space-y-1">
              <h3 className="font-label-md text-sm text-on-surface font-semibold flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[20px]">smart_toy</span>
                AI Automated Product Info Responder
              </h3>
              <p className="text-xs text-outline-variant max-w-lg">
                If a customer messages with a SKU code (e.g. `JWR-R-26-0001`), instantly reply with price, lookbook links, and real-time stock availability.
              </p>
            </div>
            <button
              onClick={() => handleToggle('enableAutoProductResponder', isResponderEnabled ? 'true' : 'false')}
              disabled={savingKey === 'enableAutoProductResponder'}
              className={`w-12 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${
                isResponderEnabled ? 'bg-primary' : 'bg-outline-variant'
              } disabled:opacity-50`}
            >
              <div
                className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${
                  isResponderEnabled ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Simulated Logs section */}
      <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-6 md:p-8 shadow-sm">
        <h3 className="font-display font-medium text-headline-sm text-primary mb-4">Background Execution Logs</h3>
        <p className="text-xs text-outline-variant mb-4">
          Visual status audit logs of recent background cron runs and outbox retry cycles.
        </p>

        <div className="border border-outline-variant/30 rounded overflow-hidden text-xs">
          <div className="bg-surface-container-low p-2 font-semibold grid grid-cols-4 border-b border-outline-variant/20">
            <span>Timestamp</span>
            <span>Task Event</span>
            <span>Status</span>
            <span>Outcome Details</span>
          </div>
          <div className="divide-y divide-outline-variant/10">
            <div className="p-2 grid grid-cols-4 font-mono text-[10px]">
              <span>24 Aug, 17:15</span>
              <span>Cron Reservation Release</span>
              <span className="text-success font-semibold">SUCCESS</span>
              <span>Released 0 expired items</span>
            </div>
            <div className="p-2 grid grid-cols-4 font-mono text-[10px]">
              <span>24 Aug, 16:15</span>
              <span>Cron Reservation Release</span>
              <span className="text-success font-semibold">SUCCESS</span>
              <span>Released 1 expired item (JWR-R-26-0001)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
