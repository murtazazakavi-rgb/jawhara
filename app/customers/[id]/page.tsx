import React from 'react';
import { notFound, redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import AppShell from '@/components/AppShell';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import DeleteCustomerButton from './DeleteCustomerButton';

export const dynamic = 'force-dynamic';

interface CustomerDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function CustomerDetailPage({ params }: CustomerDetailPageProps) {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }

  const { id } = await params;

  // 1. Fetch Customer with orders and active reservations
  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      orders: {
        include: {
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
        },
        orderBy: { createdAt: 'desc' },
      },
      reservations: {
        where: { status: 'ACTIVE' },
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
        orderBy: { reservedAt: 'desc' },
      },
    },
  });

  if (!customer) {
    notFound();
  }

  // 2. Compute CRM intelligence metrics
  const paidOrders = customer.orders.filter((o) => o.paymentStatus === 'PAID');
  const totalSpend = paidOrders.reduce((sum, o) => sum + Number(o.total), 0);
  const purchaseCount = paidOrders.length;
  const averageOrderValue = purchaseCount > 0 ? totalSpend / purchaseCount : 0;
  const lastPurchaseDate = paidOrders.length > 0 ? paidOrders[0].createdAt : null;

  const initials = customer.name
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <AppShell user={user}>
      {/* Breadcrumb path navigation */}
      <div className="flex items-center gap-4 mb-8">
        <Link
          href="/customers"
          className="text-on-surface-variant hover:text-primary transition-colors flex items-center justify-center p-2 rounded-full hover:bg-surface-container-high"
        >
          <span className="material-symbols-outlined">arrow_back</span>
        </Link>
        <div className="flex items-center gap-2 text-outline">
          <span className="font-label-sm uppercase tracking-widest">Clients</span>
          <span className="material-symbols-outlined text-xs">chevron_right</span>
          <span className="font-label-sm uppercase tracking-widest text-on-surface">Portfolio profile</span>
        </div>
      </div>

      {/* Customer Header Info */}
      <section className="bg-surface-container-lowest rounded-xl border border-outline-variant/30 p-8 mb-8 grid grid-cols-1 md:grid-cols-12 gap-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-24 h-24 bg-secondary-container/10 rounded-bl-full -mr-4 -mt-4"></div>
        <div className="md:col-span-8 flex flex-col sm:flex-row items-center sm:items-start gap-6 text-center sm:text-left">
          <div className="w-24 h-24 rounded-full bg-secondary-container text-primary flex items-center justify-center font-display text-3xl font-bold shadow-inner shrink-0">
            {initials}
          </div>
          <div className="flex-grow w-full">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="font-headline-md text-2xl text-on-surface mb-2">{customer.name}</h2>
                <div className="flex flex-col gap-1.5 text-on-surface-variant text-sm font-body-md">
                  <p className="flex items-center justify-center sm:justify-start gap-2">
                    <span className="material-symbols-outlined text-[18px]">phone</span>
                    {customer.mobile}
                  </p>
                  {customer.email && (
                    <p className="flex items-center justify-center sm:justify-start gap-2">
                      <span className="material-symbols-outlined text-[18px]">mail</span>
                      {customer.email}
                    </p>
                  )}
                  {customer.city && (
                    <p className="flex items-center justify-center sm:justify-start gap-2">
                      <span className="material-symbols-outlined text-[18px]">location_on</span>
                      {customer.city}
                    </p>
                  )}
                </div>
              </div>
              <div className="shrink-0 mt-2 sm:mt-0">
                <DeleteCustomerButton id={customer.id} />
              </div>
            </div>
          </div>
        </div>

        <div className="md:col-span-4 border-t md:border-t-0 md:border-l border-outline-variant/20 pt-6 md:pt-0 md:pl-8 flex flex-col gap-2">
          <span className="font-label-md text-xs text-outline uppercase tracking-wider">Internal Client Notes</span>
          <p className="font-body-md text-sm text-on-surface-variant italic leading-relaxed">
            {customer.notes || 'No profile notes recorded.'}
          </p>
        </div>
      </section>

      {/* Stats Cards Row */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12">
        <div className="bg-surface-container-lowest p-6 rounded-lg border border-outline-variant/30">
          <p className="font-label-sm text-on-surface-variant uppercase tracking-wider mb-2">Lifetime purchases</p>
          <p className="font-display-lg text-primary text-3xl">{purchaseCount} orders</p>
        </div>
        <div className="bg-surface-container-lowest p-6 rounded-lg border border-outline-variant/30">
          <p className="font-label-sm text-on-surface-variant uppercase tracking-wider mb-2">Lifetime spend</p>
          <p className="font-display-lg text-on-surface text-3xl">₹{totalSpend.toLocaleString('en-IN')}</p>
        </div>
        <div className="bg-surface-container-lowest p-6 rounded-lg border border-outline-variant/30">
          <p className="font-label-sm text-on-surface-variant uppercase tracking-wider mb-2">Average order value</p>
          <p className="font-display-lg text-on-surface text-3xl">₹{Math.round(averageOrderValue).toLocaleString('en-IN')}</p>
        </div>
        <div className="bg-surface-container-lowest p-6 rounded-lg border border-outline-variant/30">
          <p className="font-label-sm text-on-surface-variant uppercase tracking-wider mb-2">Last purchase date</p>
          <p className="font-display-lg text-on-surface text-2xl md:text-3xl">
            {lastPurchaseDate ? new Date(lastPurchaseDate).toLocaleDateString() : 'None'}
          </p>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter">
        {/* Left column: Purchase History */}
        <section className="lg:col-span-8 bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/30">
          <h3 className="font-headline-md text-on-surface text-xl mb-6 border-b border-outline-variant/10 pb-3">
            Boutique Purchase History
          </h3>

          {customer.orders.length === 0 ? (
            <div className="text-center py-12">
              <span className="material-symbols-outlined text-outline/30 text-5xl mb-2">shopping_bag</span>
              <p className="font-body-md text-on-surface-variant italic">No order transactions recorded yet.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {customer.orders.map((order) => (
                <div key={order.id} className="border border-outline-variant/20 rounded-lg p-5 hover:bg-surface-container-low/10 transition-colors">
                  <div className="flex justify-between items-center mb-4 pb-3 border-b border-outline-variant/10">
                    <div>
                      <span className="font-label-md text-sm text-on-surface">Order {order.orderNumber}</span>
                      <span className="text-xs text-outline ml-3">{new Date(order.createdAt).toLocaleDateString()}</span>
                    </div>
                    <div className="flex gap-2">
                      <span className={`text-[10px] font-label-sm px-2.5 py-0.5 rounded-full uppercase tracking-wider border ${
                        order.paymentStatus === 'PAID'
                          ? 'bg-primary-container/10 text-primary-container border-primary-container/20'
                          : 'bg-error-container/20 text-on-error-container border-error-container/10'
                      }`}>
                        {order.paymentStatus}
                      </span>
                      <span className="bg-surface-container-high text-on-surface-variant text-[10px] font-label-sm px-2.5 py-0.5 rounded-full uppercase tracking-wider border border-outline-variant/20">
                        {order.status}
                      </span>
                    </div>
                  </div>

                  {/* Items */}
                  <div className="flex flex-col gap-4">
                    {order.orderItems.map((item) => {
                      const img = item.product.images[0]?.url || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100';
                      return (
                        <div key={item.id} className="flex justify-between items-center">
                          <Link href={`/products/${item.productId}`} className="flex items-center gap-3 hover:text-primary transition-colors group">
                            <div className="w-12 h-16 bg-surface-container-low rounded overflow-hidden border border-outline-variant/10">
                              <img src={img} alt={item.product.name} className="w-full h-full object-cover" />
                            </div>
                            <div>
                              <p className="font-label-md text-sm truncate group-hover:underline">{item.product.name}</p>
                              <p className="font-body-sm text-xs text-on-surface-variant">Code: {item.product.productCode}</p>
                            </div>
                          </Link>
                          <div className="text-right">
                            <p className="font-body-sm text-xs text-on-surface-variant">Qty: {item.quantity}</p>
                            <p className="font-label-md text-sm text-on-surface">₹{Number(item.finalPrice).toLocaleString('en-IN')}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Right column: Active Reservations */}
        <section className="lg:col-span-4 bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/30 h-start">
          <h3 className="font-headline-md text-on-surface text-xl mb-6 border-b border-outline-variant/10 pb-3">
            Active Reservations
          </h3>

          {customer.reservations.length === 0 ? (
            <p className="font-body-md text-on-surface-variant italic">No active product reservations.</p>
          ) : (
            <div className="flex flex-col gap-4">
              {customer.reservations.map((res) => {
                const img = res.product.images[0]?.url || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100';
                return (
                  <div key={res.id} className="border border-outline-variant/20 rounded-lg p-4 flex gap-3 hover:bg-surface-container-low/10 transition-colors">
                    <div className="w-12 h-16 bg-surface-container-low rounded overflow-hidden border border-outline-variant/10 shrink-0">
                      <img src={img} alt={res.product.name} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-grow flex flex-col justify-between">
                      <div>
                        <Link href={`/products/${res.productId}`} className="font-label-md text-xs text-on-surface hover:underline truncate block">
                          {res.product.name}
                        </Link>
                        <span className="text-[10px] text-outline block">{res.product.productCode}</span>
                      </div>
                      <span className="text-[10px] text-primary font-label-sm uppercase tracking-wider block mt-1">
                        Expires: {res.expiresAt ? new Date(res.expiresAt).toLocaleDateString() : 'No expiration'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
