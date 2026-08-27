'use client';

import React, { useState } from 'react';
import Script from 'next/script';

export default function RazorpayTestPage() {
  const [amountRupees, setAmountRupees] = useState('10'); // Default to ₹10 (1000 paise)
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'modal_open' | 'success' | 'failed'>('idle');

  const addLog = (message: string) => {
    setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
  };

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatus('loading');
    setLogs([]);
    addLog('Initiating checkout...');

    const amountInPaise = Math.round(parseFloat(amountRupees) * 100);
    if (isNaN(amountInPaise) || amountInPaise < 100) {
      addLog('Error: Minimum amount is 100 paise (₹1).');
      setLoading(false);
      setStatus('failed');
      return;
    }

    try {
      // 1. Call Create Order endpoint
      addLog(`Creating order for ${amountInPaise} paise (₹${amountRupees})...`);
      const createRes = await fetch('/api/create-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: amountInPaise,
          currency: 'INR',
          receipt: `test_rcpt_${Date.now()}`,
        }),
      });

      const orderData = await createRes.json();

      if (!createRes.ok) {
        throw new Error(orderData.error || 'Failed to create order.');
      }

      addLog(`Razorpay Order Created: ${orderData.order_id}`);

      // 2. Open Razorpay Checkout Modal
      const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
      if (!keyId) {
        addLog('Error: Razorpay Key ID is missing in environment variables.');
        setLoading(false);
        setStatus('failed');
        return;
      }
      addLog(`Initializing checkout modal with Key ID: ${keyId}`);

      const options = {
        key: keyId,
        amount: orderData.amount,
        currency: orderData.currency,
        name: 'Jawhara OS',
        description: 'Razorpay Standard Checkout Test',
        order_id: orderData.order_id,
        handler: async function (response: any) {
          setStatus('loading');
          addLog('Payment authorized by user.');
          addLog(`Payment ID: ${response.razorpay_payment_id}`);
          addLog(`Order ID: ${response.razorpay_order_id}`);
          addLog(`Signature: ${response.razorpay_signature}`);
          
          // 3. Call Verify Signature endpoint
          addLog('Verifying payment signature with backend...');
          try {
            const verifyRes = await fetch('/api/verify-payment', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              }),
            });

            const verifyData = await verifyRes.json();

            if (!verifyRes.ok) {
              throw new Error(verifyData.error || 'Signature verification failed.');
            }

            addLog('Success: Payment signature verified successfully!');
            setStatus('success');
          } catch (verifyErr: any) {
            addLog(`Error verifying payment: ${verifyErr.message}`);
            setStatus('failed');
            alert(`Payment verification failed: ${verifyErr.message}`);
          } finally {
            setLoading(false);
          }
        },
        prefill: {
          name: 'Test Customer',
          email: 'test@example.com',
          contact: '9999999999',
        },
        notes: {
          address: 'Razorpay Corporate Office',
        },
        theme: {
          color: '#F43F5E',
        },
        modal: {
          ondismiss: function () {
            addLog('Checkout modal dismissed by user.');
            setStatus('idle');
            setLoading(false);
          },
        },
      };

      setStatus('modal_open');
      const rzp = new (window as any).Razorpay(options);
      
      rzp.on('payment.failed', function (response: any) {
        addLog(`Payment failed! Error Code: ${response.error.code}`);
        addLog(`Description: ${response.error.description}`);
        addLog(`Reason: ${response.error.reason}`);
        setStatus('failed');
        alert(`Payment failed: ${response.error.description}`);
        setLoading(false);
      });

      rzp.open();
    } catch (err: any) {
      addLog(`Error: ${err.message}`);
      setStatus('failed');
      setLoading(false);
      alert(`Checkout failed: ${err.message}`);
    }
  };

  return (
    <div className="bg-surface text-on-surface min-h-screen flex flex-col justify-center items-center p-4">
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
      
      <div className="w-full max-w-md bg-white border border-[#E4C8CF] rounded-2xl shadow-xl p-8 space-y-6">
        <div className="text-center space-y-2">
          <h1 className="font-display font-semibold text-3xl tracking-widest uppercase text-rose-500">
            Jawhara
          </h1>
          <p className="text-sm text-gray-500 font-label-md uppercase tracking-wider">
            Razorpay Standard Checkout
          </p>
        </div>

        <form onSubmit={handleCheckout} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-bold uppercase tracking-wider text-gray-600 block">
              Payment Amount (INR)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-gray-500 font-semibold">₹</span>
              <input
                type="number"
                min="1"
                step="0.01"
                required
                value={amountRupees}
                onChange={(e) => setAmountRupees(e.target.value)}
                disabled={loading}
                className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 text-lg font-semibold"
              />
            </div>
            <p className="text-[10px] text-gray-400">
              Equivalent to {Math.round(parseFloat(amountRupees || '0') * 100)} paise (minimum 100 paise)
            </p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-rose-500 hover:bg-rose-600 text-white rounded-xl font-bold uppercase tracking-wider transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading && status === 'loading' ? (
              <>
                <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></span>
                Processing...
              </>
            ) : (
              'Pay Now with Razorpay'
            )}
          </button>
        </form>

        {logs.length > 0 && (
          <div className="space-y-2 pt-4 border-t border-gray-100">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500">
              Transaction Logs
            </p>
            <div className="w-full h-40 bg-gray-900 rounded-xl p-3 font-mono text-[10px] text-green-400 overflow-y-auto space-y-1">
              {logs.map((log, index) => (
                <div key={index}>{log}</div>
              ))}
            </div>
          </div>
        )}

        <div className="text-center">
          <span className={`px-3 py-1 text-xs font-semibold rounded-full ${
            status === 'success' ? 'bg-green-100 text-green-800' :
            status === 'failed' ? 'bg-red-100 text-red-800' :
            status === 'modal_open' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'
          }`}>
            Status: {status.toUpperCase()}
          </span>
        </div>
      </div>
    </div>
  );
}
