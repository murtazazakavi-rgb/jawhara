/**
 * GET /api/ai/approvals - List pending AI approvals
 * PATCH /api/ai/approvals/[id] - Approve, reject, or dismiss
 * POST /api/ai/approvals/[id]/send - Execute an approved WhatsApp draft
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserWithCapability } from '@/lib/authz';

export async function GET(request: Request) {
  const user = await getUserWithCapability('USE_AI_ASSISTANT');
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

  const url = new URL(request.url);
  const status = url.searchParams.get('status') ?? 'PENDING';

  try {
    const approvals = await prisma.aIApproval.findMany({
      where: { status: status as any },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return NextResponse.json({ approvals });
  } catch (err: any) {
    console.error('[ai/approvals] GET error:', err);
    return NextResponse.json({ error: 'Could not load approvals.' }, { status: 500 });
  }
}
