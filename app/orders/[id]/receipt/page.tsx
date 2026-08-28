import React from 'react';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { getCurrentCustomer } from '@/lib/clientAuth';
import { getCurrentUser } from '@/lib/auth';
import PrintInvoiceButton from '@/components/PrintInvoiceButton';

export const dynamic = 'force-dynamic';

interface ReceiptPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function ReceiptPage({ params }: ReceiptPageProps) {
  const { id } = await params;

  // 1. Authenticate (must be logged in client or admin)
  const customer = await getCurrentCustomer();
  const admin = await getCurrentUser();

  if (!customer && !admin) {
    redirect(`/login?redirect=/orders/${id}/receipt`);
  }

  // 2. Fetch order with details
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      customer: true,
      orderItems: {
        include: {
          product: {
            include: {
              images: {
                where: { isPrimary: true },
                take: 1,
              },
            },
          },
        },
      },
      transactions: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
      shipments: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });

  if (!order) {
    notFound();
  }

  // Verify authorization: logged-in customer must be the owner of the order, unless viewer is an admin
  if (!admin && customer && order.customerId !== customer.id) {
    return (
      <div className="min-h-screen bg-surface flex flex-col justify-center items-center p-4">
        <div className="max-w-md w-full bg-surface-container-lowest border border-error/20 p-6 rounded-xl text-center space-y-4">
          <span className="material-symbols-outlined text-error text-5xl">gpp_bad</span>
          <h2 className="font-display text-lg text-on-surface font-semibold">Access Denied</h2>
          <p className="text-xs text-on-surface-variant leading-relaxed">
            You do not have permission to view this receipt.
          </p>
          <Link href="/" className="inline-block bg-primary text-white text-xs font-label-md uppercase tracking-wider px-4 py-2 rounded-lg">
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  const transaction = order.transactions[0];
  const shipment = order.shipments[0];

  // Helper for tracking steps
  const orderStatusSteps = [
    { label: 'Payment Paid', active: order.paymentStatus === 'PAID' },
    { label: 'Packing', active: ['PACKING', 'DISPATCHED', 'DELIVERED'].includes(order.status) },
    { label: 'Dispatched', active: ['DISPATCHED', 'DELIVERED'].includes(order.status) },
    { label: 'Delivered', active: order.status === 'DELIVERED' },
  ];

  return (
    <div className="bg-surface text-on-surface min-h-screen font-body-md py-10 print:py-0 print:bg-white print:text-black">
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page {
            size: A4;
            margin: 20mm;
          }
          body {
            background-color: white !important;
            color: black !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .print-no-border {
            border: none !important;
            box-shadow: none !important;
            padding: 0 !important;
            background: white !important;
          }
        }
      `}} />
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        
        {/* Navigation Bar (Hidden in Print) */}
        <div className="mb-6 flex justify-between items-center print:hidden">
          <Link href={admin ? "/admin" : "/dashboard"} className="flex items-center gap-1.5 text-primary hover:underline">
            <span className="material-symbols-outlined text-sm">arrow_back</span>
            <span className="text-xs font-label-md uppercase tracking-wider">Back to Dashboard</span>
          </Link>
          
          <PrintInvoiceButton />
        </div>

        {/* Invoice Container */}
        <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-6 sm:p-10 shadow-sm print:shadow-none print:border-none print:p-0 print-no-border">
          
          {/* Invoice Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-outline-variant/20 pb-8">
            <div className="flex flex-col">
              <span className="font-display font-semibold text-3xl tracking-widest uppercase text-primary print:text-black">
                JAWHARA
              </span>
              <span className="text-[9px] font-label-sm uppercase tracking-widest text-outline -mt-1">
                Where Every Thing Pretty Lives
              </span>
            </div>
            
            <div className="text-left sm:text-right">
              <h1 className="text-lg font-bold uppercase text-on-surface print:text-black tracking-wider font-display">Tax Invoice / Receipt</h1>
              <p className="text-xs text-outline mt-1">Order Ref: <strong className="text-on-surface print:text-black font-semibold">{order.orderNumber}</strong></p>
              <p className="text-xs text-outline">Date: {new Date(order.createdAt).toLocaleDateString('en-IN', { dateStyle: 'long' })}</p>
            </div>
          </div>

          {/* Status Tracker (Hidden in Print) */}
          <div className="my-8 print:hidden">
            <h3 className="font-label-md text-xs text-outline uppercase tracking-wider mb-4">Delivery & Order Status</h3>
            <div className="grid grid-cols-4 gap-2">
              {orderStatusSteps.map((step, idx) => (
                <div key={idx} className="flex flex-col gap-2">
                  <div className={`h-1.5 rounded-full ${step.active ? 'bg-success' : 'bg-surface-container-high'}`}></div>
                  <span className={`text-[10px] font-semibold text-center uppercase tracking-wider truncate ${step.active ? 'text-success' : 'text-outline'}`}>
                    {step.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Customer & Billing Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 my-8 py-6 border-y border-outline-variant/20">
            <div>
              <h3 className="font-label-md text-xs text-outline uppercase tracking-wider mb-2">Billed To</h3>
              <p className="text-sm font-semibold text-on-surface print:text-black">{order.customer.name}</p>
              {order.customer.email && <p className="text-xs text-on-surface-variant print:text-black mt-0.5">{order.customer.email}</p>}
              {order.customer.mobile && <p className="text-xs text-on-surface-variant print:text-black mt-0.5">{order.customer.mobile}</p>}
              {order.customer.city && <p className="text-xs text-on-surface-variant print:text-black mt-0.5">City: {order.customer.city}</p>}
            </div>

            <div className="sm:text-right">
              <h3 className="font-label-md text-xs text-outline uppercase tracking-wider mb-2">Payment Details</h3>
              <p className="text-xs text-on-surface-variant print:text-black">
                Status: <strong className="uppercase text-success">{order.paymentStatus}</strong>
              </p>
              {transaction && (
                <>
                  <p className="text-xs text-on-surface-variant print:text-black mt-0.5">Gateway: {transaction.provider}</p>
                  <p className="text-xs text-on-surface-variant print:text-black mt-0.5">Tx ID: {transaction.providerPaymentId}</p>
                  {transaction.method && <p className="text-xs text-on-surface-variant print:text-black mt-0.5">Method: {transaction.method}</p>}
                </>
              )}
            </div>
          </div>

          {/* Shipment Tracking (If shipped) */}
          {shipment && shipment.status !== 'PENDING' && (
            <div className="bg-surface-container-low/40 p-4 rounded-xl border border-outline-variant/20 mb-8 print:hidden">
              <h3 className="font-label-md text-xs text-primary font-bold uppercase tracking-wider flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">local_shipping</span>
                Shipment Tracker
              </h3>
              <div className="grid grid-cols-2 gap-4 mt-3 text-xs">
                <div>
                  <p className="text-outline">Courier Partner:</p>
                  <p className="font-semibold">{shipment.provider}</p>
                </div>
                {shipment.trackingNumber && (
                  <div>
                    <p className="text-outline">AWB / Tracking ID:</p>
                    {shipment.trackingUrl ? (
                      <a href={shipment.trackingUrl} target="_blank" className="font-semibold text-primary underline">
                        {shipment.trackingNumber}
                      </a>
                    ) : (
                      <p className="font-semibold">{shipment.trackingNumber}</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Items Table */}
          <div className="my-8">
            <h3 className="font-label-md text-xs text-outline uppercase tracking-wider mb-4">Items Summary</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-outline-variant/20 text-outline uppercase tracking-wider text-[11px] font-label-md">
                    <th className="py-2.5">Item Details</th>
                    <th className="py-2.5 text-center">Qty</th>
                    <th className="py-2.5 text-right">Unit Price</th>
                    <th className="py-2.5 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {order.orderItems.map((item) => {
                    const img = item.product.images[0]?.url || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100';
                    return (
                      <tr key={item.id} className="border-b border-outline-variant/10 align-middle">
                        <td className="py-4 flex items-center gap-3">
                          <img
                            src={img}
                            alt={item.product.name}
                            className="w-10 h-12 object-cover bg-surface-container-low rounded shrink-0"
                          />
                          <div>
                            <p className="font-semibold text-on-surface print:text-black">{item.product.name}</p>
                            <p className="text-[10px] text-outline font-mono mt-0.5">{item.product.productCode}</p>
                          </div>
                        </td>
                        <td className="py-4 text-center">{item.quantity}</td>
                        <td className="py-4 text-right">₹{Number(item.unitPrice).toLocaleString('en-IN')}</td>
                        <td className="py-4 text-right">₹{Number(item.finalPrice).toLocaleString('en-IN')}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Summary totals */}
          <div className="mt-8 pt-6 border-t border-outline-variant/20 flex justify-end">
            <div className="w-64 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-outline">Subtotal:</span>
                <span>₹{Number(order.subtotal).toLocaleString('en-IN')}</span>
              </div>
              {Number(order.discount) > 0 && (
                <div className="flex justify-between text-success">
                  <span>Discount:</span>
                  <span>-₹{Number(order.discount).toLocaleString('en-IN')}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-outline-variant/20 pt-2 text-sm font-bold text-on-surface print:text-black">
                <span>Total Amount:</span>
                <span className="text-primary print:text-black">₹{Number(order.total).toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>

          {/* Footer Note */}
          <div className="mt-16 text-center border-t border-outline-variant/10 pt-6 text-[10px] text-outline print:text-black leading-relaxed">
            <p className="font-semibold text-primary print:text-black">Thank you for shopping with Jawhara.</p>
            <p className="mt-1.5 text-on-surface-variant/80 print:text-black">
              For any bespoke custom inquiries or order adjustments, contact our lookbook concierge directly on WhatsApp: <strong className="text-primary print:text-black font-semibold">+91 7016527673</strong>
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}
