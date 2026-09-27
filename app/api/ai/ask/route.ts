/**
 * POST /api/ai/ask
 * Conversational Ask Jawhara endpoint.
 * Requires USE_AI_ASSISTANT capability.
 */

import { NextResponse } from 'next/server';
import { getUserWithCapability } from '@/lib/authz';
import { askJawhara } from '@/lib/ai/jawhara';

export async function POST(request: Request) {
  const user = await getUserWithCapability('USE_AI_ASSISTANT');
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const { question, sessionId } = body;
  if (!question?.trim()) {
    return NextResponse.json({ error: 'Question is required.' }, { status: 400 });
  }

  try {
    const result = await askJawhara({
      question: question.trim(),
      userId: user.id,
      sessionId,
    });
    return NextResponse.json(result);
  } catch (err: any) {
    console.error('[ai/ask] Error:', err);
    const isConfig = err.message?.includes('not configured');
    return NextResponse.json(
      {
        error: isConfig
          ? 'AI assistance is not configured. Please contact your administrator.'
          : 'Could not process your question. Please try again.',
      },
      { status: isConfig ? 503 : 500 }
    );
  }
}
