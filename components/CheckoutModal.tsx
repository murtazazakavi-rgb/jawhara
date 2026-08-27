'use client';

import React, { useState } from 'react';
import PhoneInput from './PhoneInput';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (notes: string, guestInfo?: {
    firstName: string;
    lastName: string;
    email: string;
    mobile: string;
    city: string;
    address: string;
  }) => void;
  price: number;
  showGuestFields?: boolean;
}

export default function CheckoutModal({
  isOpen,
  onClose,
  onConfirm,
  price,
  showGuestFields = false,
}: CheckoutModalProps) {
  const [deliveryMethod, setDeliveryMethod] = useState<'DELIVERY' | 'PICKUP'>('DELIVERY');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [pincode, setPincode] = useState('');
  const [error, setError] = useState('');

  // Guest fields state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (showGuestFields) {
      if (!firstName.trim() || !lastName.trim() || !email.trim() || !phone.trim()) {
        setError('Please fill in all guest information fields.');
        return;
      }
    }

    if (deliveryMethod === 'DELIVERY') {
      if (!address.trim() || !city.trim() || !pincode.trim()) {
        setError('Please fill in all address fields.');
        return;
      }
    }

    let notes = '';
    if (deliveryMethod === 'DELIVERY') {
      notes = `Method: Home Delivery\nAddress: ${address.trim()}\nCity: ${city.trim()}\nPincode: ${pincode.trim()}\nDelivery Charges: To be calculated and billed extra.`;
    } else {
      notes = `Method: Self-Pickup from Boutique\nPickup Location: Maison Jawhara Boutique, Mumbai\nDelivery Charges: Free`;
    }

    const guestInfo = showGuestFields ? {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.toLowerCase().trim(),
      mobile: phone,
      city: city.trim() || 'N/A',
      address: deliveryMethod === 'DELIVERY' ? address.trim() : 'Boutique Pickup',
    } : undefined;

    onConfirm(notes, guestInfo);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="w-full max-w-md bg-white border border-[#E4C8CF] rounded-2xl shadow-2xl p-6 md:p-8 space-y-6 relative max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="text-center space-y-2">
          <h2 className="font-display font-semibold text-2xl text-primary uppercase tracking-widest">
            Checkout Details
          </h2>
          <p className="text-xs text-outline font-label-md uppercase tracking-wider">
            Choose Delivery or Pickup
          </p>
        </div>

        {/* Pricing Summary */}
        <div className="bg-surface-container-low p-4 rounded-xl flex justify-between items-center text-sm font-semibold">
          <span className="text-on-surface-variant uppercase tracking-wider text-xs">Total Amount</span>
          <span className="text-primary text-base font-bold">₹{price.toLocaleString('en-IN')}</span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Guest Checkout Fields */}
          {showGuestFields && (
            <div className="space-y-4 border-b border-outline-variant/20 pb-4 animate-fade-in">
              <h3 className="text-xs font-bold uppercase tracking-wider text-primary mb-2">
                Guest Contact Information
              </h3>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block">
                    First Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Jane"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-1.5 focus:ring-primary/40 text-sm font-semibold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block">
                    Last Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Doe"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-1.5 focus:ring-primary/40 text-sm font-semibold"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block">
                  Email Address *
                </label>
                <input
                  type="email"
                  required
                  placeholder="jane@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-1.5 focus:ring-primary/40 text-sm font-semibold"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block">
                  Phone Number (Country Detection) *
                </label>
                <PhoneInput
                  value={phone}
                  onChange={setPhone}
                  required
                />
              </div>
            </div>
          )}

          {/* Method Selection */}
          <div className="space-y-2.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block">
              Fulfillment Method
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setDeliveryMethod('DELIVERY')}
                className={`py-3 px-4 rounded-xl border font-label-md text-xs uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
                  deliveryMethod === 'DELIVERY'
                    ? 'border-primary bg-primary/5 text-primary font-bold'
                    : 'border-outline-variant/50 hover:bg-surface-container-low text-on-surface-variant'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">local_shipping</span>
                Delivery
              </button>
              <button
                type="button"
                onClick={() => setDeliveryMethod('PICKUP')}
                className={`py-3 px-4 rounded-xl border font-label-md text-xs uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
                  deliveryMethod === 'PICKUP'
                    ? 'border-primary bg-primary/5 text-primary font-bold'
                    : 'border-outline-variant/50 hover:bg-surface-container-low text-on-surface-variant'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">store</span>
                Boutique Pickup
              </button>
            </div>
          </div>

          {/* Delivery Fields */}
          {deliveryMethod === 'DELIVERY' ? (
            <div className="space-y-4 animate-fade-in">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block">
                  Delivery Address *
                </label>
                <textarea
                  required
                  rows={2}
                  placeholder="Street address, building number, apartment..."
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-1.5 focus:ring-primary/40 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block">
                    City *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Mumbai"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-1.5 focus:ring-primary/40 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block">
                    Pincode *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="400001"
                    value={pincode}
                    onChange={(e) => setPincode(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-1.5 focus:ring-primary/40 text-sm"
                  />
                </div>
              </div>

              {/* Delivery Warning */}
              <div className="bg-warning/10 border border-warning/20 text-warning text-[10px] p-3 rounded-lg leading-relaxed flex items-start gap-1.5 font-medium uppercase tracking-wider">
                <span className="material-symbols-outlined text-[14px] shrink-0 mt-0.5">info</span>
                <span>Delivery charges are extra and will be billed separately based on your location.</span>
              </div>
            </div>
          ) : (
            /* Pickup Info */
            <div className="p-4 bg-surface-container-low border border-outline-variant/30 rounded-xl space-y-2 animate-fade-in">
              <p className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm">store</span>
                Boutique Address
              </p>
              <p className="text-xs text-on-surface leading-relaxed font-semibold">
                Maison Jawhara Boutique
              </p>
              <p className="text-[11px] text-on-surface-variant leading-relaxed">
                Colaba Causeway, Mumbai, Maharashtra 400001
              </p>
              <p className="text-[10px] text-success uppercase tracking-wider font-bold">
                Delivery Charges: Free of charge
              </p>
            </div>
          )}

          {error && (
            <p className="text-xs text-error font-medium leading-relaxed bg-error/10 border border-error/20 p-2.5 rounded-lg text-center">
              {error}
            </p>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 border border-outline/50 hover:bg-surface-container-low text-on-surface-variant rounded-full text-xs font-label-md uppercase tracking-wider cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-3 bg-primary hover:opacity-95 text-white rounded-full text-xs font-label-md uppercase tracking-wider cursor-pointer"
            >
              Proceed to Pay
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
