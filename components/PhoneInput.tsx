'use client';

import React, { useState, useEffect } from 'react';

interface PhoneInputProps {
  value: string; // Combined E.164 value (e.g. +919876543210)
  onChange: (value: string) => void;
  required?: boolean;
  className?: string;
}

const COUNTRIES = [
  { name: 'India', code: '+91', iso: 'IN', flag: '🇮🇳' },
  { name: 'United Arab Emirates', code: '+971', iso: 'AE', flag: '🇦🇪' },
  { name: 'Saudi Arabia', code: '+966', iso: 'SA', flag: '🇸🇦' },
  { name: 'United States', code: '+1', iso: 'US', flag: '🇺🇸' },
  { name: 'United Kingdom', code: '+44', iso: 'GB', flag: '🇬🇧' },
  { name: 'Oman', code: '+968', iso: 'OM', flag: '🇴🇲' },
  { name: 'Kuwait', code: '+965', iso: 'KW', flag: '🇰🇼' },
  { name: 'Qatar', code: '+974', iso: 'QA', flag: '🇶🇦' },
  { name: 'Bahrain', code: '+973', iso: 'BH', flag: '🇧🇭' },
];

export default function PhoneInput({ value, onChange, required = false, className = '' }: PhoneInputProps) {
  const [selectedCountry, setSelectedCountry] = useState(COUNTRIES[0]); // Default to India (+91)
  const [localNumber, setLocalNumber] = useState('');

  // Synchronize initial value from parent if it matches a country code
  useEffect(() => {
    if (!value) return;
    
    // Check if value starts with a known country code
    let matched = false;
    for (const c of COUNTRIES) {
      if (value.startsWith(c.code)) {
        setSelectedCountry(c);
        setLocalNumber(value.slice(c.code.length));
        matched = true;
        break;
      }
    }
    if (!matched && value.startsWith('+')) {
      // Unknown country code starting with +
      setLocalNumber(value);
    } else if (!matched) {
      setLocalNumber(value);
    }
  }, [value]);

  const triggerChange = (countryCode: string, num: string) => {
    // Strip non-numeric characters from local number
    const cleanedNum = num.replace(/\D/g, '');
    onChange(`${countryCode}${cleanedNum}`);
  };

  const handleCountryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = COUNTRIES.find(c => c.code === e.target.value);
    if (selected) {
      setSelectedCountry(selected);
      triggerChange(selected.code, localNumber);
    }
  };

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let typedVal = e.target.value;

    // Magic detection: check if they typed +91, +966, or started with a country prefix without a '+'
    let matchedCountry = null;

    // 1. Check for + prefix
    if (typedVal.startsWith('+')) {
      for (const c of COUNTRIES) {
        if (typedVal.startsWith(c.code)) {
          matchedCountry = c;
          typedVal = typedVal.slice(c.code.length);
          break;
        }
      }
    } else {
      // 2. Check for numeric prefix (e.g. they typed 91987... or 97150...)
      for (const c of COUNTRIES) {
        const rawCodeDigits = c.code.replace('+', '');
        if (typedVal.startsWith(rawCodeDigits) && typedVal.length > rawCodeDigits.length) {
          // Verify it's a valid match and not just a phone number starting with the same digit
          // E.g. India 91 has 2 digits, if they type 91..., it's highly likely they meant +91
          matchedCountry = c;
          typedVal = typedVal.slice(rawCodeDigits.length);
          break;
        }
      }
    }

    if (matchedCountry) {
      setSelectedCountry(matchedCountry);
      setLocalNumber(typedVal);
      triggerChange(matchedCountry.code, typedVal);
    } else {
      setLocalNumber(typedVal);
      triggerChange(selectedCountry.code, typedVal);
    }
  };

  return (
    <div className={`flex gap-2 items-center ${className}`}>
      {/* Country Select with Flags */}
      <div className="relative shrink-0">
        <span className="absolute left-2.5 top-2.5 text-base select-none pointer-events-none">
          {selectedCountry.flag}
        </span>
        <select
          value={selectedCountry.code}
          onChange={handleCountryChange}
          className="h-10 pl-8 pr-6 bg-transparent border border-gray-300 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1.5 focus:ring-primary/40 cursor-pointer appearance-none"
        >
          {COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.iso} ({c.code})
            </option>
          ))}
        </select>
        <span className="material-symbols-outlined absolute right-1.5 top-3 text-[14px] pointer-events-none select-none text-gray-500">
          arrow_drop_down
        </span>
      </div>

      {/* Local Phone Number Input */}
      <div className="flex-grow relative">
        <span className="absolute left-3 top-2.5 text-xs text-gray-400 font-semibold font-mono">
          {selectedCountry.code}
        </span>
        <input
          type="tel"
          required={required}
          placeholder="Enter phone number"
          value={localNumber}
          onChange={handleNumberChange}
          className="w-full h-10 pl-11 pr-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-1.5 focus:ring-primary/40 text-sm font-semibold font-mono"
        />
      </div>
    </div>
  );
}
