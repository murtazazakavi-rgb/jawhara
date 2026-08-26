import React from 'react';
import { getConversations } from './actions';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import WhatsAppInboxClient from './WhatsAppInboxClient';

export const dynamic = 'force-dynamic';

export default async function WhatsAppInboxPage() {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    redirect('/admin/login');
  }

  // Fetch initial conversations on the server
  const rawConversations = await getConversations();
  
  // Format dates to ISO strings for client compatibility
  const conversations = rawConversations.map(conv => ({
    ...conv,
    lastMessageAt: conv.lastMessageAt.toISOString(),
  }));

  // Fetch sales team candidates for chat assignment dropdown
  const salesTeam = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      role: true,
    },
    orderBy: {
      name: 'asc',
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display font-medium text-display-lg text-primary">Sales Center</h1>
        <p className="font-body-md text-on-surface-variant/80 text-sm max-w-xl">
          Track customer WhatsApp message feeds, view CRM profiles, and share recommended pieces to close deals.
        </p>
      </div>

      <WhatsAppInboxClient
        initialConversations={conversations as any}
        salesTeam={salesTeam as any}
        currentUser={currentUser}
      />
    </div>
  );
}
