/**
 * GET /api/ai/today
 * Returns Today screen suggestions from real business data.
 * No LLM call — pure DB → structured suggestions.
 */

import { NextResponse } from 'next/server';
import { getUserWithCapability } from '@/lib/authz';
import { generateTodaySuggestions } from '@/lib/ai/jawhara';
import { getTodaySummary } from '@/lib/ai/tools';

export async function GET() {
  const user = await getUserWithCapability('USE_AI_ASSISTANT');
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

  try {
    const [suggestions, summary] = await Promise.all([
      generateTodaySuggestions(),
      getTodaySummary(),
    ]);

    return NextResponse.json({ suggestions, summary });
  } catch (err: any) {
    console.error('[ai/today] Error:', err);
    return NextResponse.json({ error: 'Could not load today summary.' }, { status: 500 });
  }
}
