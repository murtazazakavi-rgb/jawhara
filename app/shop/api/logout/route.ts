import { NextRequest, NextResponse } from 'next/server';
import { clearCustomerSession } from '@/lib/clientAuth';

export async function GET(request: NextRequest) {
  await clearCustomerSession();
  return NextResponse.redirect(new URL('/', request.url));
}

export async function POST() {
  await clearCustomerSession();
  return NextResponse.json({ success: true });
}

