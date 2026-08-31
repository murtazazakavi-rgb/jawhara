'use client';

import React from 'react';

export function ProductCardSkeleton() {
  return (
    <div className="bg-surface-container-lowest border border-outline-variant/10 rounded-xl overflow-hidden flex flex-col shadow-xs animate-pulse">
      {/* Image Skeleton */}
      <div className="aspect-[3/4] bg-surface-container-low overflow-hidden relative">
        <div className="w-full h-full animate-shimmer" />
      </div>

      {/* Meta Skeleton */}
      <div className="p-4 flex-grow flex flex-col justify-between space-y-3">
        <div className="space-y-2">
          <div className="h-2.5 w-16 bg-surface-container-high rounded-full animate-shimmer" />
          <div className="h-4 w-3/4 bg-surface-container-high rounded-md animate-shimmer" />
          <div className="h-3 w-full bg-surface-container-high rounded-md animate-shimmer" />
        </div>

        {/* Action area */}
        <div className="pt-3 border-t border-outline-variant/10 flex flex-col gap-2">
          <div className="flex justify-between items-center">
            <div className="h-2.5 w-10 bg-surface-container-high rounded-full animate-shimmer" />
            <div className="h-4 w-14 bg-surface-container-high rounded-md animate-shimmer" />
          </div>
          <div className="h-8 w-full bg-surface-container-high rounded-full animate-shimmer mt-1" />
        </div>
      </div>
    </div>
  );
}

export function ProductGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}
