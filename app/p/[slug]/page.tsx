import React from 'react';
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { Metadata } from 'next';
import { getCurrentCustomer } from '@/lib/clientAuth';
import { getCurrentUser } from '@/lib/auth';
import ProductInquiryForm from './ProductInquiryForm';
import HoldTimerBadge from './HoldTimerBadge';
import ProductActionsClient from './ProductActionsClient';

export const dynamic = 'force-dynamic';

interface PublicProductPageProps {
  params: Promise<{
    slug: string;
  }>;
}

export async function generateMetadata({
  params,
}: PublicProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await prisma.product.findUnique({
    where: { slug, publishStatus: 'PUBLISHED' },
    include: {
      images: {
        where: { isPrimary: true },
        take: 1,
      },
    },
  });

  if (!product) {
    return {
      title: 'Product Not Found - Jawhara',
    };
  }

  const imageUrl = product.images[0]?.url || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=600';

  return {
    title: `${product.name} - Jawhara`,
    description: product.shortDesc || `Explore ${product.name} at Maison Jawhara.`,
    openGraph: {
      title: `${product.name} - Jawhara`,
      description: product.shortDesc || `Explore ${product.name} at Maison Jawhara.`,
      images: [
        {
          url: imageUrl,
          width: 800,
          height: 600,
          alt: product.name,
        },
      ],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${product.name} - Jawhara`,
      description: product.shortDesc || `Explore ${product.name} at Maison Jawhara.`,
      images: [imageUrl],
    },
  };
}

export default async function PublicProductPage({ params }: PublicProductPageProps) {
  const { slug } = await params;
  const customer = await getCurrentCustomer();

  // 1. Fetch the product using slug
  const product = await prisma.product.findUnique({
    where: { slug, publishStatus: 'PUBLISHED' },
    include: {
      category: true,
      images: {
        orderBy: { sortOrder: 'asc' },
      },
      attributes: {
        include: {
          definition: true,
        },
      },
      reservations: {
        where: { status: 'ACTIVE' },
        select: {
          id: true,
          customerId: true,
          expiresAt: true,
        },
        take: 1,
      },
    },
  });

  if (!product) {
    notFound();
  }

  const adminUser = await getCurrentUser();
  const isAdmin = !!adminUser;

  // Fetch boutique phone number from system settings
  const phoneSetting = await prisma.systemSetting.findUnique({
    where: { key: 'boutiquePhone' },
  });
  const boutiquePhone = phoneSetting?.value || '919876543210';

  // 2. Fetch similar products (same category, available, excluding self)
  const similarProducts = await prisma.product.findMany({
    where: {
      categoryId: product.categoryId,
      id: { not: product.id },
      publishStatus: 'PUBLISHED',
      inventoryStatus: {
        in: ['AVAILABLE', 'RESERVED'],
      },
    },
    include: {
      images: {
        where: { isPrimary: true },
        take: 1,
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 3,
  });

  const mainImage = product.images[0]?.url || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=600';
  const isSold = product.inventoryStatus === 'SOLD' || (!product.isUnique && product.quantity <= 0);

  // Construct WhatsApp Inquiry link
  const host = (await headers()).get('host') || 'localhost:3000';
  const protocol = host.startsWith('localhost') ? 'http' : 'https';
  const siteUrl = `${protocol}://${host}`;
  const waText = `Hi Jawhara, I am interested in inquiring about "${product.name}" (Code: ${product.productCode}). Is this piece still available?\nPrice: ₹${Number(product.price).toLocaleString('en-IN')}\nLink: ${siteUrl}/p/${product.slug}`;
  const waUrl = `https://wa.me/${boutiquePhone}?text=${encodeURIComponent(waText)}`;

  return (
    <div className="bg-surface text-on-surface min-h-screen font-body-md flex flex-col relative overflow-x-hidden">
      {/* Admin preview banner */}
      {isAdmin && (
        <div className="bg-primary/10 border-b border-primary/20 py-2.5 px-4 text-center text-xs font-semibold text-primary flex items-center justify-center gap-2 relative z-50 animate-fade-in shrink-0">
          <span className="material-symbols-outlined text-[16px] text-primary">visibility</span>
          <span>Viewing boutique Lookbook in Customer Mode.</span>
          <Link href="/admin" className="underline hover:text-primary-hover font-bold ml-1 flex items-center gap-0.5">
            Back to Admin Panel
            <span className="material-symbols-outlined text-sm">arrow_forward</span>
          </Link>
        </div>
      )}

      {/* Rose Watermark background */}
      <div className="fixed inset-0 rose-watermark opacity-[0.03] z-0"></div>

      {/* Public Header */}
      <header className="w-full py-6 border-b border-outline-variant/20 bg-surface-container-lowest z-10 sticky top-0">
        <div className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop flex justify-between items-center">
          <Link href="/" className="flex flex-col group cursor-pointer">
            <span className="font-display font-semibold text-xl tracking-widest uppercase text-primary group-hover:opacity-80 transition-opacity">
              Jawhara
            </span>
            <span className="text-[9px] font-label-sm uppercase tracking-widest text-outline -mt-1">
              Where Every Thing Pretty Lives
            </span>
          </Link>
          <Link
            href="/login"
            className="text-on-surface-variant hover:text-primary transition-colors text-xs font-label-md uppercase tracking-wider flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-sm">lock</span>
            Admin Login
          </Link>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-grow max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop py-12 md:py-20 z-10 grid grid-cols-1 md:grid-cols-12 gap-gutter">
        
        {/* Left image column */}
        <section className="md:col-span-6 flex flex-col gap-4">
          <div className="w-full aspect-[3/4] bg-surface-container-low rounded-xl overflow-hidden border border-outline-variant/30 relative">
            <img src={mainImage} alt={product.name} className="w-full h-full object-cover" />
            {isSold && (
              <div className="absolute inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center">
                <span className="bg-surface/90 text-on-surface font-display text-lg px-6 py-2 rounded-full uppercase tracking-wider shadow-md">
                  Found its home
                </span>
              </div>
            )}
          </div>
        </section>

        {/* Right Info details */}
        <section className="md:col-span-6 flex flex-col justify-start md:pl-10 pt-6 md:pt-0">
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <span className="font-label-sm text-secondary uppercase tracking-widest text-xs">
                {product.category.name}
              </span>
              {isSold && (
                <span className="text-[10px] font-label-sm uppercase tracking-wider px-2.5 py-0.5 bg-outline-variant/30 text-outline border border-outline-variant/30 rounded font-bold">
                  Sold Out
                </span>
              )}
              {product.inventoryStatus === 'RESERVED' && (
                <span className="text-[10px] font-label-sm uppercase tracking-wider px-2.5 py-0.5 bg-error/15 text-error border border-error/20 rounded font-bold flex items-center gap-1">
                  <span className="material-symbols-outlined text-[12px]">schedule</span>
                  On Hold
                </span>
              )}
            </div>
            <h1 className="font-display-lg text-3xl md:text-5xl text-on-surface mt-1 mb-4 leading-tight">
              {product.name}
            </h1>
            <p className="text-[10px] font-label-sm text-outline uppercase tracking-wider mb-6">
              Product Code: {product.productCode}
            </p>
            <div className="flex items-baseline gap-4 mb-8">
              <span className="font-headline-lg text-primary text-2xl md:text-3xl">
                ₹{Number(product.price).toLocaleString('en-IN')}
              </span>
            </div>
            
            {product.inventoryStatus === 'RESERVED' && (
              <HoldTimerBadge expiresAt={product.reservations[0]?.expiresAt?.toISOString()} />
            )}
            <p className="font-body-lg text-on-surface-variant leading-relaxed">
              {product.description || 'Exquisite design curated by Maison Jawhara.'}
            </p>
          </div>

          {/* Specifications */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-4 py-6 border-y border-outline-variant/20 mb-8 text-sm">
            <div className="flex flex-col gap-0.5">
              <span className="font-label-sm text-outline uppercase text-[10px]">Primary Color</span>
              <span className="font-body-md text-on-surface">{product.primaryColour || 'Boutique palette'}</span>
            </div>
            {product.secondaryColours && (
              <div className="flex flex-col gap-0.5">
                <span className="font-label-sm text-outline uppercase text-[10px]">Accents</span>
                <span className="font-body-md text-on-surface">{product.secondaryColours}</span>
              </div>
            )}

            {/* Custom attributes */}
            {product.attributes.map((attr) => (
              <div key={attr.id} className="flex flex-col gap-0.5">
                <span className="font-label-sm text-outline uppercase text-[10px]">
                  {attr.definition.name}
                </span>
                <span className="font-body-md text-on-surface">{attr.value}</span>
              </div>
            ))}
          </div>

          {/* CTA Buttons */}
          <div className="mb-16">
            <ProductActionsClient
              productId={product.id}
              productSlug={product.slug}
              productName={product.name}
              productPrice={Number(product.price)}
              inventoryStatus={product.inventoryStatus}
              isUnique={product.isUnique}
              quantity={product.quantity}
              customer={customer ? {
                id: customer.id,
                name: customer.name,
                email: customer.email,
                mobile: customer.mobile,
                normalizedMobile: customer.normalizedMobile
              } : null}
              activeReservation={product.reservations[0] ? {
                id: product.reservations[0].id,
                customerId: product.reservations[0].customerId,
                expiresAt: product.reservations[0].expiresAt ? product.reservations[0].expiresAt.toISOString() : null
              } : null}
              waUrl={waUrl}
              productCode={product.productCode}
              productImage={product.images[0]?.url || null}
            />
          </div>

          <ProductInquiryForm productId={product.id} isLoggedIn={!!customer} />

          {/* Similar pieces */}
          {similarProducts.length > 0 && (
            <div>
              <h3 className="font-headline-md text-on-surface text-lg mb-6 border-b border-outline-variant/15 pb-2 inline-block">
                Discover Similar Pieces
              </h3>
              <div className="grid grid-cols-3 gap-4">
                {similarProducts.map((p) => {
                  const img = p.images[0]?.url || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200';
                  return (
                    <Link key={p.id} href={`/p/${p.slug}`} className="group flex flex-col gap-1.5">
                      <div className="aspect-[3/4] w-full bg-surface-container-low rounded-lg overflow-hidden border border-outline-variant/15 relative">
                        <img
                          src={img}
                          alt={p.name}
                          className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-500"
                        />
                      </div>
                      <h4 className="font-label-md text-on-surface text-xs truncate group-hover:text-primary transition-colors">
                        {p.name}
                      </h4>
                      <p className="font-body-sm text-[11px] text-on-surface-variant">₹{Number(p.price).toLocaleString('en-IN')}</p>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      </main>

      {/* Footer */}
      <footer className="w-full py-8 text-center border-t border-outline-variant/10 bg-surface-container-lowest z-10 flex flex-col items-center">
        <span className="font-label-sm uppercase tracking-widest text-outline text-[10px]">
          Jawhara - Dynamic Lookbook by MJZ © 2026
        </span>
      </footer>
    </div>
  );
}
