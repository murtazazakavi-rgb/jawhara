import { NextResponse } from 'next/server';
import { suggestProductDetails } from '@/lib/ai';
import { getSession } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    // Authenticate the user
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized. Please sign in.' }, { status: 401 });
    }

    const { imageUrl, categoryName } = await request.json();

    if (!imageUrl) {
      return NextResponse.json({ error: 'No image URL provided.' }, { status: 400 });
    }

    const suggestions = await suggestProductDetails(imageUrl, categoryName);
    return NextResponse.json(suggestions);
  } catch (error: any) {
    console.error('AI suggestion route error:', error);
    return NextResponse.json(
      { error: error.message || 'AI analysis failed. Please complete product manually.' },
      { status: 500 }
    );
  }
}
