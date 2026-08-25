import { NextResponse } from 'next/server';
import { clearCustomerSession } from '@/lib/clientAuth';

export async function POST() {
  await clearCustomerSession();
  return NextResponse.json({ success: true });
}
