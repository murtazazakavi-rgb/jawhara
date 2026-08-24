import React from 'react';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import AppShell from '@/components/AppShell';
import { prisma } from '@/lib/prisma';
import AutomationsClient from './AutomationsClient';

export const dynamic = 'force-dynamic';

export default async function AutomationsPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }

  // Role Security Check - SALES role cannot access automations config
  if (user.role === 'SALES') {
    redirect('/');
  }

  const settings = await prisma.systemSetting.findMany();

  return (
    <AppShell user={user}>
      {/* Header section */}
      <div className="mb-10 relative">
        <span
          className="material-symbols-outlined absolute -top-10 -right-4 text-[120px] text-primary/5 pointer-events-none z-[-1]"
          style={{ fontVariationSettings: "'FILL' 1'" }}
        >
          settings_suggest
        </span>
        <h1 className="font-display font-medium text-display-lg text-primary mb-2">Automations</h1>
        <p className="font-body-md text-on-surface-variant/80 text-sm max-w-xl">
          Configure workflow automations, toggle triggers, and view cron executions logs.
        </p>
      </div>

      <AutomationsClient initialSettings={settings} />
    </AppShell>
  );
}
