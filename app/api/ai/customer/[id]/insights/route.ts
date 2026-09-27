/**
 * GET /api/ai/customer/[id]/insights
 * Returns AI-generated customer insights for the customer detail page.
 * POST creates a WhatsApp draft and puts it in the approval queue.
 */

import { NextResponse } from 'next/server';
import { getUserWithCapability } from '@/lib/authz';
import { generateCustomerInsights, prepareWhatsAppDraft } from '@/lib/ai/jawhara';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const user = await getUserWithCapability('USE_AI_ASSISTANT');
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

  try {
    const insights = await generateCustomerInsights(id);
    if (!insights) return NextResponse.json({ error: 'Customer not found.' }, { status: 404 });
    return NextResponse.json(insights);
  } catch (err: any) {
    console.error('[ai/customer/insights] GET error:', err);
    return NextResponse.json({ error: 'Could not generate insights.' }, { status: 500 });
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
    const result = await prepareWhatsAppDraft({
      customerId: id,
      context: body.context,
      userId: user.id,
    });

    return NextResponse.json(result);
  } catch (err: any) {
    console.error('[ai/customer/insights] POST error:', err);
    return NextResponse.json(
      { error: err.message || 'Could not prepare draft.' },
      { status: 500 }
    );
  }
}
