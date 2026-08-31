import React from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import AppShell from '@/components/AppShell';
import { prisma } from '@/lib/prisma';
import ReservedProductsList from './ReservedProductsList';
import ProductsListClient from './ProductsListClient';

export const dynamic = 'force-dynamic';

interface ProductsPageProps {
  searchParams: Promise<{
    search?: string;
    category?: string;
    status?: string;
    publish?: string;
    sort?: string;
  }>;
}

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/admin/login');
  }

  const params = await searchParams;
  const search = params.search || '';
  const categoryId = params.category || '';
  const status = params.status || 'ALL';
  const publish = params.publish || 'ALL';
  const sort = params.sort || 'newest';

  // 1. Build DB Query filters
  const where: any = {};

  if (search) {
    where.OR = [
      { name: { contains: search } },
      { productCode: { contains: search } },
      { primaryColour: { contains: search } },
      { secondaryColours: { contains: search } },
      { description: { contains: search } },
    ];
  }

  if (categoryId) {
    where.categoryId = categoryId;
  }

  if (status !== 'ALL') {
    where.inventoryStatus = status;
  }

  if (publish !== 'ALL') {
    where.publishStatus = publish;
  } else {
    where.publishStatus = {
      not: 'ARCHIVED',
    };
  }

  // 2. Build Sort order
  let orderBy: any = { createdAt: 'desc' };
  if (sort === 'price-asc') {
    orderBy = { price: 'asc' };
  } else if (sort === 'price-desc') {
    orderBy = { price: 'desc' };
  } else if (sort === 'oldest') {
    orderBy = { createdAt: 'asc' };
  }

  // 3. Fetch products, categories, collections
  const includeQuery: any = {
    category: true,
    collection: true,
    attributes: {
      include: { definition: true },
    },
    images: {
      orderBy: { isPrimary: 'desc' },
      take: 1,
    },
  };

  if (status === 'RESERVED') {
    includeQuery.reservations = {
      where: { status: 'ACTIVE' },
      include: { customer: true },
      orderBy: { reservedAt: 'desc' },
      take: 1,
    };
  }

  const products = await prisma.product.findMany({
    where,
    include: includeQuery,
    orderBy,
  });

  const categories = await prisma.productCategory.findMany({
    where: { isActive: true },
  });

  const statusTabs = [
    { label: 'All Items', value: 'ALL' },
    { label: 'Available', value: 'AVAILABLE' },
    { label: 'Reserved', value: 'RESERVED' },
    { label: 'Sold', value: 'SOLD' },
  ];

  return (
    <AppShell user={user}>
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
        <div>
          <h1 className="font-display-lg text-on-surface mb-2">Boutique Catalogue</h1>
          <p className="font-body-lg text-on-surface-variant">View and manage your unique collections, apparel, and home décor.</p>
        </div>
        <Link
          href="/products/add"
          className="bg-primary text-on-primary hover:opacity-90 transition-opacity px-6 py-3 rounded font-label-md flex items-center justify-center gap-2 shadow-sm hover:shadow-md self-start md:self-auto"
        >
          <span className="material-symbols-outlined text-[20px]">add</span>
          Add Product
        </Link>
      </div>

      {/* Search and Filters Bar */}
      <section className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/30 mb-8 flex flex-col gap-6">
        <form method="GET" action="/products" className="grid grid-cols-1 md:grid-cols-12 gap-4">
          {/* Text Search */}
          <div className="md:col-span-4 relative flex items-center border-b border-outline-variant/50 focus-within:border-primary transition-colors">
            <span className="material-symbols-outlined text-outline absolute left-0 text-[20px]">search</span>
            <input
              type="text"
              name="search"
              defaultValue={search}
              placeholder="Search product code, name, colour..."
              className="w-full pl-8 py-2 bg-transparent border-0 focus:ring-0 font-body-md placeholder:text-outline/50"
            />
          </div>

          {/* Category Filter */}
          <div className="md:col-span-3 border-b border-outline-variant/50 focus-within:border-primary transition-colors">
            <select
              name="category"
              defaultValue={categoryId}
              className="w-full py-2 bg-transparent border-0 focus:ring-0 font-body-md"
            >
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Sort Filter */}
          <div className="md:col-span-3 border-b border-outline-variant/50 focus-within:border-primary transition-colors">
            <select
              name="sort"
              defaultValue={sort}
              className="w-full py-2 bg-transparent border-0 focus:ring-0 font-body-md"
            >
              <option value="newest">Sort: Newest</option>
              <option value="oldest">Sort: Oldest</option>
              <option value="price-asc">Sort: Price Low to High</option>
              <option value="price-desc">Sort: Price High to Low</option>
            </select>
          </div>

          {/* Submit Button */}
          <div className="md:col-span-2 flex items-end">
            <button
              type="submit"
              className="w-full bg-primary-container text-on-primary-container hover:opacity-90 font-label-md py-2.5 rounded uppercase tracking-wider text-xs cursor-pointer"
            >
              Apply Filter
            </button>
          </div>

          {/* Preserving other params */}
          <input type="hidden" name="status" value={status} />
          <input type="hidden" name="publish" value={publish} />
        </form>

        {/* Tab Selection */}
        <div className="border-b border-outline-variant/20 flex gap-6 overflow-x-auto scrollbar-none">
          {statusTabs.map((tab) => {
            const isActive = tab.value === status;
            // Build tab link
            const tabParams = new URLSearchParams();
            if (search) tabParams.set('search', search);
            if (categoryId) tabParams.set('category', categoryId);
            if (publish !== 'ALL') tabParams.set('publish', publish);
            if (sort !== 'newest') tabParams.set('sort', sort);
            tabParams.set('status', tab.value);
            const href = `/products?${tabParams.toString()}`;

            return (
              <Link
                key={tab.value}
                href={href}
                className={`pb-3 font-label-md text-sm border-b-2 whitespace-nowrap transition-colors ${
                  isActive
                    ? 'text-primary border-primary'
                    : 'text-on-surface-variant border-transparent hover:text-primary'
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
      </section>

      {/* Products Grid or Reservations List */}
      {products.length === 0 ? (
        <div className="bg-surface-container-lowest text-center rounded-xl p-16 border border-outline-variant/30">
          <span className="material-symbols-outlined text-outline/30 text-6xl mb-4">folder_open</span>
          <h3 className="font-headline-md text-on-surface mb-2">Your collection begins here.</h3>
          <p className="font-body-md text-on-surface-variant max-w-md mx-auto mb-6">
            Add your first Jawhara product to begin building your boutique catalogue.
          </p>
          <Link
            href="/products/add"
            className="bg-primary text-on-primary hover:opacity-90 px-6 py-3 rounded font-label-md inline-flex items-center gap-2"
          >
            <span className="material-symbols-outlined">add</span> Add Product
          </Link>
        </div>
      ) : status === 'RESERVED' ? (
        <ReservedProductsList products={products as any} />
      ) : (
        <ProductsListClient products={products as any} />
      )}
    </AppShell>
  );
}

