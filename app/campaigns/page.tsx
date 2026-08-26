import React from 'react';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import AppShell from '@/components/AppShell';
import { getCampaigns } from './actions';
import CampaignsClient from './CampaignsClient';

export const dynamic = 'force-dynamic';

export default async function CampaignsPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/admin/login');
  }

  // Role Security Check - SALES role cannot access marketing campaigns
  if (user.role === 'SALES') {
    redirect('/');
  }

  // Fetch initial campaign logs
  const rawCampaigns = await getCampaigns();
  
  // Format dates for Client Component compliance
  const campaigns = rawCampaigns.map(c => ({
    ...c,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  }));

  return (
    <AppShell user={user}>
      {/* Header section */}
      <div className="mb-10 relative">
        <span
          className="material-symbols-outlined absolute -top-10 -right-4 text-[120px] text-primary/5 pointer-events-none z-[-1]"
          style={{ fontVariationSettings: "'FILL' 1'" }}
        >
          campaign
        </span>
        <h1 className="font-display font-medium text-display-lg text-primary mb-2">Campaigns</h1>
        <p className="font-body-md text-on-surface-variant/80 text-sm max-w-xl">
          Dispatch WhatsApp broadcasts to target client segments and monitor sales conversion analytics.
        </p>
      </div>

      <CampaignsClient initialCampaigns={campaigns as any} />
    </AppShell>
  );
}
