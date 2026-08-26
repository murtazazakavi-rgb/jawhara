import React from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import AppShell from '@/components/AppShell';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/admin/login');
  }

  // 1. Fetch metrics
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todaySalesResult = await prisma.order.aggregate({
    _sum: {
      total: true,
    },
    where: {
      createdAt: {
        gte: today,
      },
    },
  });
  const todaySales = todaySalesResult._sum.total || 0;

  const availableCount = await prisma.product.count({
    where: { inventoryStatus: 'AVAILABLE', publishStatus: 'PUBLISHED' },
  });

  const reservedCount = await prisma.product.count({
    where: { inventoryStatus: 'RESERVED' },
  });

  const pendingOrdersCount = await prisma.order.count({
    where: { status: 'PENDING' },
  });

  // 2. Fetch Attention Items
  // Active reservations
  const activeReservations = await prisma.reservation.findMany({
    where: { status: 'ACTIVE' },
    include: {
      product: true,
      customer: true,
    },
    take: 3,
    orderBy: { reservedAt: 'desc' },
  });

  // Pending unpaid orders
  const pendingUnpaidOrders = await prisma.order.findMany({
    where: {
      status: 'PENDING',
      paymentStatus: 'UNPAID',
    },
    include: {
      customer: true,
    },
    take: 3,
    orderBy: { createdAt: 'desc' },
  });

  // 3. Recently Added Products
  const recentProducts = await prisma.product.findMany({
    where: { publishStatus: 'PUBLISHED' },
    include: {
      images: {
        where: { isPrimary: true },
        take: 1,
      },
      category: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 4,
  });

  // 4. Recent Activity Log
  const recentActivities = await prisma.activityLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5,
  });

  return (
    <AppShell user={user}>
      {/* Header */}
      <div className="mb-10 relative">
        <span className="material-symbols-outlined absolute -top-10 -right-4 text-[120px] text-primary/5 pointer-events-none z-[-1]" style={{ fontVariationSettings: "'FILL' 1" }}>
          local_florist
        </span>
        <h1 className="font-display-lg text-on-surface mb-2">Boutique Overview</h1>
        <p className="font-body-lg text-on-surface-variant">Here is an summary of your boutique operational metrics for today.</p>
      </div>

      {/* Metrics Bento Grid */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12">
        {/* Metric 1 */}
        <div className="bg-surface-container-lowest p-6 rounded-lg border border-outline-variant/30 relative overflow-hidden group hover:shadow-[0_4px_20px_rgba(0,0,0,0.03)] transition-all">
          <p className="font-label-sm text-on-surface-variant uppercase tracking-wider mb-2">Today's Sales</p>
          <p className="font-display-lg text-primary text-3xl md:text-4xl">₹{todaySales.toLocaleString('en-IN')}</p>
          <div className="absolute right-3 bottom-3 opacity-10">
            <span className="material-symbols-outlined text-[48px]">payments</span>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="bg-surface-container-lowest p-6 rounded-lg border border-outline-variant/30 relative overflow-hidden group hover:shadow-[0_4px_20px_rgba(0,0,0,0.03)] transition-all">
          <p className="font-label-sm text-on-surface-variant uppercase tracking-wider mb-2">In Catalog</p>
          <p className="font-display-lg text-on-surface text-3xl md:text-4xl">{availableCount}</p>
          <div className="absolute right-3 bottom-3 opacity-10">
            <span className="material-symbols-outlined text-[48px]">inventory_2</span>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="bg-surface-container-lowest p-6 rounded-lg border border-outline-variant/30 relative overflow-hidden group hover:shadow-[0_4px_20px_rgba(0,0,0,0.03)] transition-all">
          <p className="font-label-sm text-on-surface-variant uppercase tracking-wider mb-2">Reserved Items</p>
          <p className="font-display-lg text-on-surface text-3xl md:text-4xl">{reservedCount}</p>
          <div className="absolute right-3 bottom-3 opacity-10">
            <span className="material-symbols-outlined text-[48px]">bookmark</span>
          </div>
        </div>

        {/* Metric 4 */}
        <div className="bg-surface-container-lowest p-6 rounded-lg border border-outline-variant/30 relative overflow-hidden group hover:shadow-[0_4px_20px_rgba(0,0,0,0.03)] transition-all">
          <p className="font-label-sm text-on-surface-variant uppercase tracking-wider mb-2">Pending Orders</p>
          <p className="font-display-lg text-on-surface text-3xl md:text-4xl">{pendingOrdersCount}</p>
          <div className="absolute right-3 bottom-3 opacity-10">
            <span className="material-symbols-outlined text-[48px]">shopping_bag</span>
          </div>
        </div>
      </section>

      {/* Main Grid Content: Attention + Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter mb-12">
        {/* Left Side: Attention items */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          <section className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/30">
            <h2 className="font-headline-md text-on-surface mb-6 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">priority_high</span>
              Requires Attention
            </h2>

            {activeReservations.length === 0 && pendingUnpaidOrders.length === 0 ? (
              <div className="text-center py-10">
                <span className="material-symbols-outlined text-outline/40 text-5xl mb-3">done_all</span>
                <p className="font-body-md text-on-surface-variant">All caught up! No items require attention today.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {/* Active Reservations */}
                {activeReservations.map((res) => (
                  <div key={res.id} className="p-4 border border-outline-variant/20 rounded-lg flex items-center justify-between hover:bg-surface-container-low transition-colors">
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-primary bg-secondary-container/30 p-2 rounded-full">bookmark</span>
                      <div>
                        <p className="font-label-md text-on-surface">Reservation: {res.product.name}</p>
                        <p className="font-body-sm text-[13px] text-on-surface-variant">
                          For <span className="font-semibold">{res.customer.name}</span> · Code: {res.product.productCode}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-label-sm text-xs text-primary">Active</p>
                      <p className="font-body-sm text-[11px] text-on-surface-variant">
                        {res.expiresAt ? `Expires: ${new Date(res.expiresAt).toLocaleDateString()}` : 'No Expiry'}
                      </p>
                    </div>
                  </div>
                ))}

                {/* Pending Unpaid Orders */}
                {pendingUnpaidOrders.map((ord) => (
                  <div key={ord.id} className="p-4 border border-outline-variant/20 rounded-lg flex items-center justify-between hover:bg-surface-container-low transition-colors">
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-error bg-error-container/20 p-2 rounded-full">unpaid</span>
                      <div>
                        <p className="font-label-md text-on-surface">Unpaid Order: {ord.orderNumber}</p>
                        <p className="font-body-sm text-[13px] text-on-surface-variant">
                          Client: {ord.customer.name} · Amount: ₹{Number(ord.total).toLocaleString('en-IN')}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="bg-error-container text-on-error-container text-[11px] font-label-sm px-2 py-0.5 rounded">
                        UNPAID
                      </span>
                      <p className="font-body-sm text-[11px] text-on-surface-variant mt-1">
                        {new Date(ord.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Recently Added Products Slider */}
          <section className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/30">
            <div className="flex justify-between items-center mb-6">
              <h2 className="font-headline-md text-on-surface">Recently Added</h2>
              <Link href="/products" className="font-label-md text-primary uppercase hover:opacity-80">
                View Catalog
              </Link>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {recentProducts.map((p) => {
                const mainImg = p.images[0]?.url || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=300';
                return (
                  <Link key={p.id} href={`/products/${p.id}`} className="group flex flex-col gap-2">
                    <div className="aspect-[3/4] w-full bg-surface-container-low rounded-lg overflow-hidden border border-outline-variant/20 relative">
                      <img
                        src={mainImg}
                        alt={p.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                      <span className="absolute top-2 left-2 bg-surface-container-lowest/80 backdrop-blur-sm text-[9px] font-label-sm px-1.5 py-0.5 rounded uppercase tracking-wider text-on-surface">
                        {p.category.name}
                      </span>
                    </div>
                    <div>
                      <h4 className="font-label-md text-on-surface text-sm truncate group-hover:text-primary transition-colors">
                        {p.name}
                      </h4>
                      <p className="font-body-sm text-xs text-on-surface-variant">₹{Number(p.price).toLocaleString('en-IN')}</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        </div>

        {/* Right Side: Timeline / Activities */}
        <div className="lg:col-span-4">
          <section className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/30 h-full flex flex-col">
            <h2 className="font-headline-md text-on-surface mb-6 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">history</span>
              Recent Activity
            </h2>

            {recentActivities.length === 0 ? (
              <div className="text-center py-10 flex-grow flex flex-col items-center justify-center">
                <span className="material-symbols-outlined text-outline/30 text-4xl mb-2">history</span>
                <p className="font-body-sm text-on-surface-variant">No activity logged yet.</p>
              </div>
            ) : (
              <div className="relative border-l border-outline-variant/30 ml-3 pl-4 flex flex-col gap-6">
                {recentActivities.map((act) => (
                  <div key={act.id} className="relative text-sm">
                    {/* Circle node */}
                    <div className="absolute -left-[21px] top-1 bg-primary w-2.5 h-2.5 rounded-full border-2 border-surface-container-lowest"></div>
                    <div>
                      <p className="font-label-sm text-xs text-on-surface uppercase tracking-wider">
                        {act.entityType} {act.action.toLowerCase()}
                      </p>
                      <p className="font-body-sm text-[13px] text-on-surface-variant mt-0.5">
                        Entity ID: {act.entityId.slice(0, 8)}
                      </p>
                      <span className="text-[10px] text-outline font-label-sm">
                        {new Date(act.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </AppShell>
  );
}
