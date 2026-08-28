'use client';

import React, { useState, useTransition } from 'react';
import { updateOrderStatus, updateOrderPayment } from './actions';

interface OrdersClientProps {
  initialOrders: any[];
  metrics: {
    totalOrders: number;
    pendingShipments: number;
    totalRevenue: number;
  };
}

export default function OrdersClient({ initialOrders, metrics }: OrdersClientProps) {
  const [isPending, startTransition] = useTransition();
  const [statusTab, setStatusTab] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const statusParam = params.get('status');
      if (statusParam) {
        setStatusTab(statusParam);
      }
      const searchParam = params.get('search');
      if (searchParam) {
        setSearchTerm(searchParam);
      }
    }
  }, []);

  // Status transitions
  const handleStatusChange = (orderId: string, status: any) => {
    startTransition(async () => {
      const res = await updateOrderStatus({ orderId, status });
      if (res.error) {
        alert(res.error);
      } else {
        // Update selected order in state if open
        if (selectedOrder && selectedOrder.id === orderId) {
          setSelectedOrder((prev: any) => ({ ...prev, status }));
        }
        window.location.reload();
      }
    });
  };

  const handlePaymentChange = (orderId: string, paymentStatus: any) => {
    startTransition(async () => {
      const res = await updateOrderPayment({ orderId, paymentStatus });
      if (res.error) {
        alert(res.error);
      } else {
        if (selectedOrder && selectedOrder.id === orderId) {
          setSelectedOrder((prev: any) => ({ ...prev, paymentStatus }));
        }
        window.location.reload();
      }
    });
  };

  // Filter and search
  const filteredOrders = initialOrders.filter((order) => {
    const matchesTab = statusTab === 'ALL' || order.status === statusTab;
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      order.orderNumber.toLowerCase().includes(term) ||
      order.customer.name.toLowerCase().includes(term) ||
      order.customer.mobile.includes(term) ||
      (order.notes && order.notes.toLowerCase().includes(term));
    return matchesTab && matchesSearch;
  });

  const tabs = [
    { label: 'All Orders', value: 'ALL' },
    { label: 'Pending', value: 'PENDING' },
    { label: 'Packing', value: 'PACKING' },
    { label: 'Dispatched', value: 'DISPATCHED' },
    { label: 'Delivered', value: 'DELIVERED' },
    { label: 'Returned', value: 'RETURNED' },
  ];

  return (
    <div className="flex flex-col gap-10">
      {/* Header Summary */}
      <div>
        <h1 className="font-display-lg text-on-surface mb-2">Orders Management</h1>
        <p className="font-body-lg text-on-surface-variant font-sans">Manage and track your recent sales.</p>
      </div>

      {/* Summary Metrics Cards */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-surface-container-lowest p-6 rounded-lg border border-outline-variant/50 relative overflow-hidden group hover:shadow-md transition-all">
          <p className="font-label-md text-on-surface-variant uppercase tracking-wider mb-2">Total Orders</p>
          <p className="font-display-lg text-on-surface">{metrics.totalOrders}</p>
          <div className="absolute right-3 bottom-3 opacity-10">
            <span className="material-symbols-outlined text-[54px] text-primary">inventory_2</span>
          </div>
        </div>

        <div className="bg-surface-container-lowest p-6 rounded-lg border border-outline-variant/50 relative overflow-hidden group hover:shadow-md transition-all">
          <p className="font-label-md text-on-surface-variant uppercase tracking-wider mb-2">Pending Shipments</p>
          <p className="font-display-lg text-on-surface">{metrics.pendingShipments}</p>
          <div className="absolute right-3 bottom-3 opacity-10">
            <span className="material-symbols-outlined text-[54px] text-primary">local_shipping</span>
          </div>
        </div>

        {/* AI Insight banner */}
        <div className="bg-[#E4C8CF]/30 p-6 rounded-lg border border-[#E4C8CF] relative overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="material-symbols-outlined text-primary text-[20px]">auto_awesome</span>
              <p className="font-label-sm text-on-surface-variant uppercase tracking-wider">AI Operations Insight</p>
            </div>
            <p className="font-headline-sm text-sm md:text-base text-on-surface leading-tight">
              Order processing time is average. Ship pending Rida pieces within 24 hours to maximize customer luxury experience.
            </p>
          </div>
        </div>
      </section>

      {/* Orders Directory Card */}
      <section className="bg-surface-container-lowest rounded-xl border border-outline-variant/30 shadow-sm p-6">
        {/* Filters and search */}
        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-6">
          {/* Tabs */}
          <div className="flex gap-4 overflow-x-auto scrollbar-none border-b border-outline-variant/20 pb-1 flex-grow">
            {tabs.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setStatusTab(tab.value)}
                className={`pb-2.5 font-label-md text-xs uppercase tracking-wider border-b-2 whitespace-nowrap transition-colors ${
                  statusTab === tab.value
                    ? 'text-primary border-primary'
                    : 'text-on-surface-variant border-transparent hover:text-primary'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 text-on-surface-variant bg-surface-container-low px-4 py-2 rounded border border-outline-variant/30">
            <span className="material-symbols-outlined text-[18px]">search</span>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search order number, client..."
              className="bg-transparent border-none outline-none focus:ring-0 font-body-md text-sm placeholder:text-on-surface-variant/50 w-full md:w-64"
            />
          </div>
        </div>

        {/* List View table */}
        <div className="flex flex-col gap-4">
          {/* Header Row */}
          <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-3 border-b border-outline-variant/50 font-label-sm text-[11px] text-on-surface-variant uppercase tracking-wider">
            <div className="col-span-2">Order</div>
            <div className="col-span-3">Customer</div>
            <div className="col-span-3">Items</div>
            <div className="col-span-2">Payment</div>
            <div className="col-span-2 text-right">Total</div>
          </div>

          {filteredOrders.length === 0 ? (
            <div className="text-center py-12">
              <span className="material-symbols-outlined text-outline/30 text-5xl mb-2">shopping_cart</span>
              <p className="font-body-md text-on-surface-variant italic">No order entries found.</p>
            </div>
          ) : (
            filteredOrders.map((order) => {
              const itemSummary = order.orderItems
                .map((i: any) => `${i.product.name} (x${i.quantity})`)
                .join(', ');

              return (
                <div
                  key={order.id}
                  onClick={() => setSelectedOrder(order)}
                  className="bg-surface border border-outline-variant/20 rounded-lg py-2.5 px-4 md:px-5 hover:shadow-md transition-all cursor-pointer flex flex-col md:grid md:grid-cols-12 md:items-center gap-3 text-xs"
                >
                  <div className="md:col-span-2">
                    <span className="font-headline-sm text-xs text-primary block font-semibold">{order.orderNumber}</span>
                    <span className="text-[9px] text-outline block mt-0.5">
                      {new Date(order.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="md:col-span-3">
                    <p className="font-label-md text-xs text-on-surface font-semibold">{order.customer.name}</p>
                    <p className="font-body-sm text-[10px] text-on-surface-variant">{order.customer.mobile}</p>
                  </div>
                  <div className="md:col-span-3 flex flex-col items-start">
                    <p className="font-body-sm text-xs text-on-surface-variant truncate max-w-full">{itemSummary}</p>
                    <select
                      value={order.status}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => {
                        e.stopPropagation();
                        handleStatusChange(order.id, e.target.value);
                      }}
                      className="bg-surface-container-high text-on-surface-variant text-[9px] font-label-sm px-1.5 py-0.5 rounded uppercase tracking-wider border border-outline-variant/35 cursor-pointer outline-none focus:border-primary font-bold mt-1"
                    >
                      <option value="PENDING">PENDING</option>
                      <option value="PACKING">PACKING</option>
                      <option value="DISPATCHED">DISPATCHED</option>
                      <option value="DELIVERED">DELIVERED</option>
                      <option value="RETURNED">RETURNED</option>
                    </select>
                  </div>
                  <div className="md:col-span-2 flex items-center gap-2">
                    <select
                      value={order.paymentStatus}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => {
                        e.stopPropagation();
                        handlePaymentChange(order.id, e.target.value);
                      }}
                      className={`text-[9px] font-label-sm px-2.5 py-0.5 rounded-full border cursor-pointer outline-none font-bold ${
                        order.paymentStatus === 'PAID'
                          ? 'bg-success/15 text-success border-success/30'
                          : 'bg-error/15 text-error border-error/30'
                      }`}
                    >
                      <option value="PAID">PAID</option>
                      <option value="UNPAID">UNPAID</option>
                    </select>
                  </div>
                  <div className="md:col-span-2 text-right font-headline-sm text-on-surface text-sm md:text-base font-semibold">
                    ₹{order.total.toLocaleString('en-IN')}
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
          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-8 max-w-lg w-full shadow-2xl relative overflow-y-auto max-h-[90vh]">
            <button
              onClick={() => setSelectedOrder(null)}
              className="absolute top-4 right-4 text-outline hover:text-on-surface transition-colors"
            >
              <span className="material-symbols-outlined">close</span>
            </button>

            <h3 className="font-display font-semibold text-headline-sm text-on-surface mb-1">
              Order Details: {selectedOrder.orderNumber}
            </h3>
            <p className="font-body-sm text-xs text-outline mb-6">
              Registered on {new Date(selectedOrder.createdAt).toLocaleString()}
            </p>

            <div className="flex flex-col gap-6">
              {/* Customer details */}
              <div className="p-4 bg-surface rounded-lg border border-outline-variant/20 flex flex-col gap-1.5">
                <span className="font-label-md text-xs text-secondary uppercase">Buyer Client</span>
                <p className="font-label-md text-sm text-on-surface">{selectedOrder.customer.name}</p>
                <p className="font-body-sm text-xs text-on-surface-variant">{selectedOrder.customer.mobile} · {selectedOrder.customer.email || 'No email'}</p>
              </div>

              {/* Items List */}
              <div className="flex flex-col gap-3">
                <span className="font-label-md text-xs text-secondary uppercase">Purchased Items</span>
                {selectedOrder.orderItems.map((item: any) => (
                  <div key={item.id} className="flex justify-between items-center border-b border-outline-variant/10 pb-3 last:border-0">
                    <div>
                      <p className="font-label-md text-sm text-on-surface">{item.product.name}</p>
                      <p className="font-body-sm text-xs text-outline">SKU: {item.product.productCode}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-body-sm text-xs text-on-surface-variant">Qty: {item.quantity}</p>
                      <p className="font-label-md text-sm text-primary">₹{item.finalPrice.toLocaleString('en-IN')}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pricing breakdown */}
              <div className="flex flex-col gap-2 border-t border-outline-variant/20 pt-4">
                <div className="flex justify-between text-sm font-body-md text-on-surface-variant">
                  <span>Subtotal</span>
                  <span>₹{selectedOrder.subtotal.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between text-sm font-body-md text-on-surface-variant">
                  <span>Discount</span>
                  <span>-₹{selectedOrder.discount.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between text-base font-headline-sm text-on-surface pt-2 border-t border-outline-variant/10">
                  <span>Grand Total</span>
                  <span className="text-primary">₹{selectedOrder.total.toLocaleString('en-IN')}</span>
                </div>
              </div>

              {selectedOrder.notes && (
                <div className="flex flex-col gap-1">
                  <span className="font-label-md text-xs text-secondary uppercase">Transaction Notes</span>
                  <p className="font-body-sm text-xs text-on-surface-variant italic">"{selectedOrder.notes}"</p>
                </div>
              )}

              {/* Control Action buttons */}
              <div className="flex flex-col gap-4 border-t border-outline-variant/20 pt-6 mt-2">
                <span className="font-label-md text-xs text-secondary uppercase">Boutique Operational Status</span>
                
                <div className="grid grid-cols-2 gap-3">
                  {/* Status switches */}
                  <div className="flex flex-col gap-1.5">
                    <label className="font-label-sm text-[10px] text-outline uppercase">Fulfilment</label>
                    <select
                      value={selectedOrder.status}
                      disabled={isPending}
                      onChange={(e) => handleStatusChange(selectedOrder.id, e.target.value)}
                      className="bg-transparent border border-outline-variant rounded px-3 py-1.5 font-label-sm text-xs focus:ring-0 focus:border-primary"
                    >
                      <option value="PENDING">Pending Packing</option>
                      <option value="PACKING">Packing</option>
                      <option value="DISPATCHED">Dispatched / Sent</option>
                      <option value="DELIVERED">Delivered</option>
                      <option value="RETURNED">Returned</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="font-label-sm text-[10px] text-outline uppercase">Payment</label>
                    <select
                      value={selectedOrder.paymentStatus}
                      disabled={isPending}
                      onChange={(e) => handlePaymentChange(selectedOrder.id, e.target.value)}
                      className="bg-transparent border border-outline-variant rounded px-3 py-1.5 font-label-sm text-xs focus:ring-0 focus:border-primary"
                    >
                      <option value="UNPAID">Unpaid</option>
                      <option value="PAID">Paid / Received</option>
                      <option value="REFUNDED">Refunded</option>
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
