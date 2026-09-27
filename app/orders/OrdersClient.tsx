'use client';

import React, { useState, useTransition } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { updateOrderStatus, updateOrderPayment } from './actions';
import { useToast } from '@/components/Toast';

// Every OrderStatus value, so a select never falls back to showing the wrong one
const ORDER_STATUS_OPTIONS = [
  { value: 'PENDING', label: 'Pending' },
  { value: 'PACKING', label: 'Packing' },
  { value: 'READY_FOR_PICKUP', label: 'Ready for pickup' },
  { value: 'PICKUP_REQUESTED', label: 'Pickup requested' },
  { value: 'DISPATCHED', label: 'Dispatched' },
  { value: 'IN_TRANSIT', label: 'In transit' },
  { value: 'OUT_FOR_DELIVERY', label: 'Out for delivery' },
  { value: 'DELIVERED', label: 'Delivered' },
  { value: 'DELIVERY_FAILED', label: 'Delivery failed' },
  { value: 'RETURNED', label: 'Returned' },
];

// Every PaymentStatus value; the ones set only by the payment gateway are
// shown (so the select is accurate) but can't be chosen by hand.
const PAYMENT_STATUS_OPTIONS = [
  { value: 'UNPAID', label: 'Unpaid', manual: true },
  { value: 'PENDING', label: 'Pending', manual: false },
  { value: 'PAID', label: 'Paid', manual: true },
  { value: 'PARTIALLY_REFUNDED', label: 'Part refunded', manual: false },
  { value: 'REFUNDED', label: 'Refunded', manual: true },
  { value: 'FAILED', label: 'Failed', manual: false },
];

const IN_TRANSIT_STATUSES = ['READY_FOR_PICKUP', 'PICKUP_REQUESTED', 'DISPATCHED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY'];

/** Confirmation copy for changes that notify the customer or move stock. */
const STATUS_CONFIRM: Record<string, string> = {
  DISPATCHED: 'Mark as dispatched? The customer will get a WhatsApp dispatch message.',
  RETURNED: 'Mark as returned? All items in this order will be put back into stock.',
};
const PAYMENT_CONFIRM: Record<string, string> = {
  PAID: 'Mark this order as paid? The customer may get a payment confirmation.',
  REFUNDED: 'Mark this order as refunded?',
  UNPAID: 'Mark this order as unpaid?',
};

function formatDeliveryAddress(order: any) {
  const parts = [order.deliveryAddress, order.deliveryCity, order.deliveryState, order.deliveryPincode].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : null;
}

interface OrdersClientProps {
  initialOrders: any[];
  metrics: {
    totalOrders: number;
    pendingShipments: number;
    totalRevenue: number;
  };
}

export default function OrdersClient({ initialOrders, metrics }: OrdersClientProps) {
  const router = useRouter();
  const toast = useToast();
  const [isPending, startTransition] = useTransition();
  const [statusTab, setStatusTab] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<string | null>(null);
  // Derived from props so the modal reflects fresh data after router.refresh()
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const selectedOrder = initialOrders.find((o) => o.id === selectedOrderId) ?? null;
  const setSelectedOrder = (order: any | null) => setSelectedOrderId(order?.id ?? null);

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const statusParam = params.get('status');
      if (statusParam) {
        setStatusTab(statusParam);
      }
      const paymentParam = params.get('payment');
      if (paymentParam) {
        setPaymentFilter(paymentParam);
      }
      const searchParam = params.get('search');
      if (searchParam) {
        setSearchTerm(searchParam);
      }
    }
  }, []);

  // Status transitions
  const handleStatusChange = (orderId: string, status: string) => {
    if (STATUS_CONFIRM[status] && !confirm(STATUS_CONFIRM[status])) return;
    startTransition(async () => {
      const res = await updateOrderStatus({ orderId, status });
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success('Order status updated.');
        router.refresh();
      }
    });
  };

  const handlePaymentChange = (orderId: string, paymentStatus: any) => {
    if (PAYMENT_CONFIRM[paymentStatus] && !confirm(PAYMENT_CONFIRM[paymentStatus])) return;
    startTransition(async () => {
      const res = await updateOrderPayment({ orderId, paymentStatus });
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success('Payment status updated.');
        router.refresh();
      }
    });
  };

  // Filter and search
  const filteredOrders = initialOrders.filter((order) => {
    const matchesTab =
      statusTab === 'ALL' ||
      (statusTab === 'IN_TRANSIT' ? IN_TRANSIT_STATUSES.includes(order.status) : order.status === statusTab);
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      order.orderNumber.toLowerCase().includes(term) ||
      order.customer.name.toLowerCase().includes(term) ||
      (order.customer.mobile ?? '').includes(term) ||
      (order.customer.email ?? '').toLowerCase().includes(term) ||
      (order.notes && order.notes.toLowerCase().includes(term));
    const matchesPayment = !paymentFilter || order.paymentStatus === paymentFilter;
    return matchesTab && matchesSearch && matchesPayment;
  });

  const tabs = [
    { label: 'All Orders', value: 'ALL' },
    { label: 'Pending', value: 'PENDING' },
    { label: 'Packing', value: 'PACKING' },
    { label: 'In transit', value: 'IN_TRANSIT' },
    { label: 'Delivered', value: 'DELIVERED' },
    { label: 'Returned', value: 'RETURNED' },
  ];

  return (
    <div className="flex flex-col gap-8">
      {/* Header Summary */}
      <div>
        <h1 className="font-display-lg text-on-surface mb-2">Orders Management</h1>
        <p className="font-body-lg text-on-surface-variant font-sans">Manage and track your lookbook client orders and dispatches.</p>
      </div>

      {/* Summary Metrics Cards */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-surface-container-lowest p-5 rounded-xl border border-outline-variant/30 relative overflow-hidden group hover:shadow-sm transition-all">
          <p className="font-label-md text-xs text-on-surface-variant uppercase tracking-wider mb-1">Total Orders</p>
          <p className="font-display-lg text-2xl md:text-3xl text-on-surface">{metrics.totalOrders}</p>
          <div className="absolute right-3 bottom-3 opacity-10">
            <span className="material-symbols-outlined text-[48px] text-primary">inventory_2</span>
          </div>
        </div>

        <div className="bg-surface-container-lowest p-5 rounded-xl border border-outline-variant/30 relative overflow-hidden group hover:shadow-sm transition-all">
          <p className="font-label-md text-xs text-on-surface-variant uppercase tracking-wider mb-1">Pending Shipments</p>
          <p className="font-display-lg text-2xl md:text-3xl text-on-surface">{metrics.pendingShipments}</p>
          <div className="absolute right-3 bottom-3 opacity-10">
            <span className="material-symbols-outlined text-[48px] text-primary">local_shipping</span>
          </div>
        </div>

        {/* AI Insight banner */}
        <div className="bg-[#E4C8CF]/30 p-5 rounded-xl border border-[#E4C8CF] relative overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <span className="material-symbols-outlined text-primary text-[18px]">auto_awesome</span>
              <p className="font-label-sm text-xs text-on-surface-variant uppercase tracking-wider font-bold">Boutique Operations</p>
            </div>
            <p className="font-body-sm text-xs text-on-surface leading-snug">
              Ship pending Rida orders promptly to maintain an exceptional bespoke luxury client experience.
            </p>
          </div>
        </div>
      </section>

      {/* Filters & Orders List */}
      <section className="bg-surface-container-lowest border border-outline-variant/25 rounded-xl p-4 md:p-6 shadow-xs flex flex-col gap-6">
        {/* Search & Tabs */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          {/* Tabs */}
          <div className="flex gap-4 overflow-x-auto scrollbar-none border-b border-outline-variant/20 pb-1 flex-grow">
            {tabs.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setStatusTab(tab.value)}
                className={`pb-2.5 font-label-md text-xs uppercase tracking-wider border-b-2 whitespace-nowrap transition-colors cursor-pointer ${
                  statusTab === tab.value
                    ? 'text-primary border-primary font-bold'
                    : 'text-on-surface-variant border-transparent hover:text-primary'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {paymentFilter && (
            <button
              type="button"
              onClick={() => setPaymentFilter(null)}
              className="text-xs px-3 py-1.5 rounded-full bg-primary/10 text-primary font-semibold flex items-center gap-1 cursor-pointer"
              aria-label="Clear payment filter"
            >
              Payment: {PAYMENT_STATUS_OPTIONS.find((o) => o.value === paymentFilter)?.label ?? paymentFilter}
              <span className="material-symbols-outlined text-[14px]">close</span>
            </button>
          )}

          <div className="flex items-center gap-2 text-on-surface-variant bg-surface-container-low px-3 py-1.5 rounded-lg border border-outline-variant/30">
            <span className="material-symbols-outlined text-[16px]">search</span>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search order #, client..."
              className="bg-transparent border-none outline-none focus:ring-0 font-body-md text-xs placeholder:text-on-surface-variant/50 w-full md:w-56"
            />
          </div>
        </div>

        {/* List View Table */}
        <div className="flex flex-col gap-3">
          {/* Header Row */}
          <div className="hidden md:grid grid-cols-12 gap-3 px-4 py-2.5 bg-surface-container-low/40 rounded-lg text-[10px] font-label-md uppercase tracking-widest text-outline">
            <div className="col-span-2">Order # / Date</div>
            <div className="col-span-3">Customer</div>
            <div className="col-span-4">Purchased Pieces</div>
            <div className="col-span-1 text-center">Payment</div>
            <div className="col-span-2 text-right">Total / Status</div>
          </div>

          {filteredOrders.length === 0 ? (
            <div className="text-center py-12">
              <span className="material-symbols-outlined text-outline/30 text-5xl mb-2">shopping_bag</span>
              <p className="font-body-md text-on-surface-variant italic">No order entries found.</p>
            </div>
          ) : (
            filteredOrders.map((order) => {
              return (
                <div
                  key={order.id}
                  onClick={() => setSelectedOrder(order)}
                  className="bg-surface border border-outline-variant/20 rounded-xl p-3 md:px-4 md:py-3 hover:shadow-md hover:border-primary/30 transition-all cursor-pointer flex flex-col md:grid md:grid-cols-12 md:items-center gap-3 text-xs"
                >
                  {/* Order # & Date */}
                  <div className="md:col-span-2 flex flex-col">
                    <span className="font-mono text-xs font-bold text-primary">{order.orderNumber}</span>
                    <span className="text-[10px] text-outline mt-0.5">
                      {new Date(order.createdAt).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                  </div>

                  {/* Customer */}
                  <div className="md:col-span-3 flex flex-col min-w-0">
                    <p className="font-label-md text-xs text-on-surface font-semibold truncate">{order.customer.name}</p>
                    <p className="font-body-sm text-[10px] text-on-surface-variant">{order.customer.mobile}</p>
                  </div>

                  {/* Items with Photos */}
                  <div className="md:col-span-4 flex items-center gap-3 min-w-0">
                    {/* Item Thumbnails Stack */}
                    <div className="flex -space-x-2 overflow-hidden shrink-0">
                      {order.orderItems.slice(0, 3).map((item: any, idx: number) => {
                        const imgUrl = item.product?.images?.[0]?.url || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100';
                        return (
                          <div
                            key={idx}
                            className="relative w-10 h-12 rounded-md overflow-hidden border border-white bg-surface-container-high shadow-2xs shrink-0"
                          >
                            <Image
                              src={imgUrl}
                              alt={item.product?.name || 'Product'}
                              fill
                              sizes="48px"
                              className="object-cover"
                            />
                          </div>
                        );
                      })}
                      {order.orderItems.length > 3 && (
                        <div className="w-10 h-12 rounded-md bg-surface-container-high border border-white flex items-center justify-center text-[10px] font-bold text-outline">
                          +{order.orderItems.length - 3}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col min-w-0">
                      <p className="font-body-sm text-xs text-on-surface font-medium truncate">
                        {order.orderItems[0]?.product?.name}
                        {order.orderItems.length > 1 && ` +${order.orderItems.length - 1} more`}
                      </p>
                      <span className="text-[10px] text-outline">
                        {order.orderItems.reduce((acc: number, item: any) => acc + item.quantity, 0)} total unit(s)
                      </span>
                    </div>
                  </div>

                  {/* Payment Badge */}
                  <div className="md:col-span-1 flex items-center justify-start md:justify-center">
                    <select
                      value={order.paymentStatus}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => {
                        e.stopPropagation();
                        handlePaymentChange(order.id, e.target.value);
                      }}
                      className={`text-[9px] font-label-sm px-2 py-0.5 rounded-full border cursor-pointer outline-none font-bold uppercase tracking-wider ${
                        order.paymentStatus === 'PAID'
                          ? 'bg-success/15 text-success border-success/30'
                          : ['UNPAID', 'FAILED'].includes(order.paymentStatus)
                          ? 'bg-error/15 text-error border-error/30'
                          : 'bg-surface-container-high text-on-surface-variant border-outline-variant/35'
                      }`}
                    >
                      {PAYMENT_STATUS_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value} disabled={!opt.manual}>
                          {opt.label.toUpperCase()}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Total & Fulfillment Status */}
                  <div className="md:col-span-2 flex items-center justify-between md:justify-end gap-3">
                    <span className="font-headline-sm text-xs md:text-sm font-bold text-on-surface">
                      ₹{order.total.toLocaleString('en-IN')}
                    </span>
                    <select
                      value={order.status}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => {
                        e.stopPropagation();
                        handleStatusChange(order.id, e.target.value);
                      }}
                      className="bg-surface-container-high text-on-surface-variant text-[9px] font-label-sm px-2 py-1 rounded-md uppercase tracking-wider border border-outline-variant/35 cursor-pointer outline-none focus:border-primary font-bold"
                    >
                      {ORDER_STATUS_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label.toUpperCase()}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* Order Details Modal Overlay */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-6 md:p-8 max-w-lg w-full shadow-2xl relative overflow-y-auto max-h-[90vh]">
            <button
              onClick={() => setSelectedOrder(null)}
              className="absolute top-4 right-4 text-outline hover:text-on-surface transition-colors cursor-pointer"
              aria-label="Close order details"
            >
              <span className="material-symbols-outlined">close</span>
            </button>

            <h3 className="font-display-lg text-lg md:text-xl text-on-surface mb-1">
              Order {selectedOrder.orderNumber}
            </h3>
            <div className="flex items-center justify-between gap-3 mb-6">
              <p className="font-body-sm text-xs text-outline">
                Placed {new Date(selectedOrder.createdAt).toLocaleString('en-IN')}
              </p>
              <Link
                href={`/orders/${selectedOrder.id}/receipt`}
                target="_blank"
                className="text-xs text-primary font-semibold flex items-center gap-1 hover:underline shrink-0"
              >
                <span className="material-symbols-outlined text-[16px]">receipt_long</span>
                Receipt
              </Link>
            </div>

            <div className="flex flex-col gap-6">
              {/* Customer details */}
              <div className="p-4 bg-surface rounded-xl border border-outline-variant/20 flex flex-col gap-1">
                <span className="font-label-md text-[10px] text-secondary uppercase tracking-wider">Buyer Client</span>
                <p className="font-headline-sm text-sm text-on-surface font-bold">{selectedOrder.customer.name}</p>
                <p className="font-body-sm text-xs text-on-surface-variant">
                  {selectedOrder.customer.mobile} · {selectedOrder.customer.email || 'No email provided'}
                </p>
                {formatDeliveryAddress(selectedOrder) ? (
                  <div className="text-xs text-on-surface-variant mt-2 border-t border-outline-variant/15 pt-2 flex items-start gap-1.5">
                    <span className="material-symbols-outlined text-[16px] text-outline">location_on</span>
                    <span>
                      {selectedOrder.deliveryName && <strong className="block text-on-surface">{selectedOrder.deliveryName}</strong>}
                      {formatDeliveryAddress(selectedOrder)}
                      {selectedOrder.deliveryPhone && <span className="block">{selectedOrder.deliveryPhone}</span>}
                    </span>
                  </div>
                ) : (
                  <p className="text-xs text-outline mt-2 border-t border-outline-variant/15 pt-2">
                    No delivery address on the order — check the checkout notes below.
                  </p>
                )}
              </div>

              {/* Items List with Photos */}
              <div className="flex flex-col gap-3">
                <span className="font-label-md text-[10px] text-secondary uppercase tracking-wider">Purchased Boutique Items</span>
                {selectedOrder.orderItems.map((item: any) => {
                  const imgUrl = item.product?.images?.[0]?.url || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150';
                  return (
                    <div key={item.id} className="flex items-center justify-between border-b border-outline-variant/10 pb-3 last:border-0 gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="relative w-12 h-14 rounded-lg overflow-hidden border border-outline-variant/30 bg-surface-container-high shrink-0">
                          <Image
                            src={imgUrl}
                            alt={item.product?.name || 'Product'}
                            fill
                            sizes="56px"
                            className="object-cover"
                          />
                        </div>
                        <div className="min-w-0">
                          <p className="font-headline-sm text-xs md:text-sm text-on-surface font-semibold truncate">{item.product?.name}</p>
                          <p className="font-mono text-[9px] text-outline">SKU: {item.product?.productCode}</p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-body-sm text-[11px] text-on-surface-variant">Qty: {item.quantity}</p>
                        <p className="font-headline-sm text-xs md:text-sm font-bold text-primary">₹{item.finalPrice.toLocaleString('en-IN')}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Pricing breakdown */}
              <div className="flex flex-col gap-2 border-t border-outline-variant/20 pt-4">
                <div className="flex justify-between text-xs font-body-md text-on-surface-variant">
                  <span>Subtotal</span>
                  <span>₹{selectedOrder.subtotal.toLocaleString('en-IN')}</span>
                </div>
                {selectedOrder.discount > 0 && (
                  <div className="flex justify-between text-xs font-body-md text-success">
                    <span>Discount</span>
                    <span>-₹{selectedOrder.discount.toLocaleString('en-IN')}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-headline-sm text-on-surface pt-2 border-t border-outline-variant/10 font-bold">
                  <span>Grand Total</span>
                  <span className="text-primary text-base">₹{selectedOrder.total.toLocaleString('en-IN')}</span>
                </div>
              </div>

              {selectedOrder.notes && (
                <div className="flex flex-col gap-1 bg-surface-container-low p-3 rounded-lg">
                  <span className="font-label-md text-[10px] text-secondary uppercase tracking-wider">Transaction Notes</span>
                  <p className="font-body-sm text-xs text-on-surface-variant italic">"{selectedOrder.notes}"</p>
                </div>
              )}

              {/* Control Action buttons */}
              <div className="flex flex-col gap-3 border-t border-outline-variant/20 pt-4">
                <span className="font-label-md text-[10px] text-secondary uppercase tracking-wider">Boutique Operational Status</span>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="font-label-sm text-[10px] text-outline uppercase">Fulfilment</label>
                    <select
                      value={selectedOrder.status}
                      disabled={isPending}
                      onChange={(e) => handleStatusChange(selectedOrder.id, e.target.value)}
                      className="bg-transparent border border-outline-variant rounded-lg px-3 py-1.5 font-label-sm text-xs focus:ring-0 focus:border-primary"
                    >
                      {ORDER_STATUS_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="font-label-sm text-[10px] text-outline uppercase">Payment</label>
                    <select
                      value={selectedOrder.paymentStatus}
                      disabled={isPending}
                      onChange={(e) => handlePaymentChange(selectedOrder.id, e.target.value)}
                      className="bg-transparent border border-outline-variant rounded-lg px-3 py-1.5 font-label-sm text-xs focus:ring-0 focus:border-primary"
                    >
                      {PAYMENT_STATUS_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value} disabled={!opt.manual}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
