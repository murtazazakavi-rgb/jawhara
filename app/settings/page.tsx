import React from 'react';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import AppShell from '@/components/AppShell';
import { prisma } from '@/lib/prisma';
import SettingsClient from './SettingsClient';
import { MessageDirection } from '@prisma/client';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }

  // 1. Fetch template mappings
  const templates = await prisma.whatsAppTemplate.findMany({
    orderBy: { internalKey: 'asc' },
  });

  // 2. Fetch system settings
  const settings = await prisma.systemSetting.findMany();

  // 3. Fetch latest chat metrics for health telemetry
  const lastInboundMsg = await prisma.whatsAppMessage.findFirst({
    where: { direction: MessageDirection.INBOUND },
    orderBy: { createdAt: 'desc' },
  });

  const lastOutboundMsg = await prisma.whatsAppMessage.findFirst({
    where: { direction: MessageDirection.OUTBOUND },
    orderBy: { createdAt: 'desc' },
  });

  const lastInboundStr = lastInboundMsg
    ? new Date(lastInboundMsg.createdAt).toLocaleDateString('en-IN', { hour: '2-digit', minute: '2-digit' })
    : 'Never';

  const lastOutboundStr = lastOutboundMsg
    ? new Date(lastOutboundMsg.createdAt).toLocaleDateString('en-IN', { hour: '2-digit', minute: '2-digit' })
    : 'Never';

  // 4. Compute integrations health statuses
  const isMetaWa = process.env.WHATSAPP_PROVIDER === 'meta';
  const hasMetaCreds = !!process.env.META_WHATSAPP_ACCESS_TOKEN && !!process.env.META_WHATSAPP_PHONE_NUMBER_ID;
  
  const whatsappHealth = {
    status: isMetaWa && hasMetaCreds ? 'Connected (Live)' : 'Connected (Mock Mode)',
    details: isMetaWa && hasMetaCreds
      ? `Connected using Business Phone ID: ${process.env.META_WHATSAPP_PHONE_NUMBER_ID}`
      : 'Mock API client configured for local development. Outbound logs print to terminal output.',
    lastInbound: lastInboundStr,
    lastOutbound: lastOutboundStr,
  };

  const isRazorpayLive = process.env.PAYMENT_PROVIDER === 'razorpay';
  const hasRazorpayCreds = !!process.env.RAZORPAY_KEY_ID && !!process.env.RAZORPAY_KEY_SECRET;

  const razorpayHealth = {
    status: isRazorpayLive && hasRazorpayCreds ? 'Connected (Live)' : 'Connected (Mock Mode)',
    details: isRazorpayLive && hasRazorpayCreds
      ? `Live API Key configured: ${process.env.RAZORPAY_KEY_ID?.substring(0, 8) || ''}...`
      : 'Mock transactions link generator enabled. Payment confirmations simulated via sandbox webhooks.',
  };

  const geminiHealth = {
    status: process.env.GEMINI_API_KEY ? 'Connected' : 'Offline (Fallback Mock)',
    details: process.env.GEMINI_API_KEY
      ? `Initialized model: ${process.env.GEMINI_MODEL || 'gemini-1.5-flash'}`
      : 'No API key provided. Fallback mock generated descriptors and tags are generated for product wizards.',
  };

  const isVercelBlob = process.env.STORAGE_PROVIDER === 'vercelBlob' || !!process.env.BLOB_READ_WRITE_TOKEN;
  const storageHealth = {
    status: isVercelBlob ? 'Vercel Blob Storage' : 'Local Disk Storage',
    details: isVercelBlob
      ? 'Assets are uploaded to your persistent cloud storage bucket.'
      : 'Assets are written to public/uploads directory. Perfect for zero-configuration local runs.',
  };

  const healthStatus = {
    whatsapp: whatsappHealth,
    razorpay: razorpayHealth,
    gemini: geminiHealth,
    storage: storageHealth,
  };

  return (
    <AppShell user={user}>
      {/* Header section */}
      <div className="mb-10 relative">
        <span
          className="material-symbols-outlined absolute -top-10 -right-4 text-[120px] text-primary/5 pointer-events-none z-[-1]"
          style={{ fontVariationSettings: "'FILL' 1'" }}
        >
          local_florist
        </span>
        <h1 className="font-display font-medium text-display-lg text-primary mb-2">Settings</h1>
        <p className="font-body-md text-on-surface-variant/80 text-sm max-w-xl">
          Manage your boutique configuration, integration connections, and message template triggers.
        </p>
      </div>

      <SettingsClient
        initialTemplates={templates}
        initialSettings={settings}
        healthStatus={healthStatus}
      />
    </AppShell>
  );
}
