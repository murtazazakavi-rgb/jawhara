/**
 * PATCH /api/ai/approvals/[id]
 * Approve, reject, or dismiss an AI approval.
 *
 * POST /api/ai/approvals/[id]/execute
 * Execute an approved approval (e.g. send WhatsApp message).
 * Only available after explicit APPROVED status.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserWithCapability } from '@/lib/authz';
import { sendWhatsAppMessage } from '@/lib/integrations/whatsapp/provider';
import { MessageDirection, MessageStatus } from '@prisma/client';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const user = await getUserWithCapability('USE_AI_ASSISTANT');
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

  let body: any;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  // action: APPROVED | REJECTED | DISMISSED, or PENDING to return an approved
  // item to the queue when executing it failed
  const { action, notes } = body;

  if (!['APPROVED', 'REJECTED', 'DISMISSED', 'PENDING'].includes(action)) {
    return NextResponse.json({ error: 'Invalid action.' }, { status: 400 });
  }

  try {
    const approval = await prisma.aIApproval.update({
      where: { id },
      data:
        action === 'PENDING'
          ? { status: action, reviewedBy: null, reviewedAt: null }
          : {
              status: action,
              reviewedBy: user.id,
              reviewedAt: new Date(),
              reviewNotes: notes,
            },
    });

    return NextResponse.json({ approval });
  } catch (err: any) {
    if (err.code === 'P2025') return NextResponse.json({ error: 'Approval not found.' }, { status: 404 });
    console.error('[ai/approvals] PATCH error:', err);
    return NextResponse.json({ error: 'Could not update approval.' }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const user = await getUserWithCapability('USE_AI_ASSISTANT');
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

  let body: any = {};
  try { body = await request.json(); } catch {}

  try {
    const approval = await prisma.aIApproval.findUnique({ where: { id } });
    if (!approval) return NextResponse.json({ error: 'Approval not found.' }, { status: 404 });

    if (approval.status !== 'APPROVED') {
      return NextResponse.json(
        { error: 'Only approved items can be executed.' },
        { status: 422 }
      );
    }

    if (approval.type === 'WHATSAPP_MESSAGE' && approval.entityType === 'CUSTOMER') {
      const customer = await prisma.customer.findUnique({
        where: { id: approval.entityId! },
        select: { id: true, name: true, normalizedMobile: true },
      });

      if (!customer?.normalizedMobile) {
        return NextResponse.json(
          { error: 'Customer has no WhatsApp number.' },
          { status: 422 }
        );
      }

      const content = approval.proposedContent as any;
      // staff selects which draft to send via body.draftIndex (default 0)
      const draftIndex = typeof body.draftIndex === 'number' ? body.draftIndex : 0;
      const drafts: string[] = content?.drafts ?? [];
      const messageText = drafts[draftIndex] ?? drafts[0];

      if (!messageText) {
        return NextResponse.json({ error: 'No draft message found.' }, { status: 422 });
      }

      const sendRes = await sendWhatsAppMessage({
        to: customer.normalizedMobile,
        type: 'text',
        text: { body: messageText },
      });

      if (!sendRes.success) {
        return NextResponse.json({ error: 'Failed to send WhatsApp message.' }, { status: 500 });
      }

      // Log to conversation
      const conv = await prisma.whatsAppConversation.findUnique({
        where: { waId: customer.normalizedMobile },
      });
      if (conv) {
        await prisma.whatsAppMessage.create({
          data: {
            conversationId: conv.id,
            providerMessageId: sendRes.providerMessageId,
            direction: MessageDirection.OUTBOUND,
            type: 'TEXT',
            status: MessageStatus.SENT,
            body: messageText,
            sentAt: new Date(),
          },
        });
      }

      // Mark approval as executed
      await prisma.aIApproval.update({
        where: { id },
        data: { reviewNotes: (approval.reviewNotes ?? '') + '\n[Executed: WhatsApp sent]' },
      });

      return NextResponse.json({ success: true, messageSent: true });
    }

    return NextResponse.json({ success: true, message: 'Executed.' });
  } catch (err: any) {
    console.error('[ai/approvals/execute] POST error:', err);
    return NextResponse.json({ error: 'Could not execute approval.' }, { status: 500 });
  }
}
