import { NextResponse } from 'next/server';
import Razorpay from 'razorpay';
import { getUserWithCapability } from '@/lib/authz';

export async function POST(request: Request) {
  try {
    // This endpoint exists only for the local Razorpay diagnostic screen.
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Not found.' }, { status: 404 });
    }

    const admin = await getUserWithCapability('MANAGE_SETTINGS');
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    // 2. Parse and validate request
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON request body.' }, { status: 400 });
    }

    const { amount, currency = 'INR', receipt } = body;

    if (amount === undefined || amount === null) {
      return NextResponse.json({ error: 'Amount is required.' }, { status: 400 });
    }

    const amountInPaise = Number(amount);
    if (isNaN(amountInPaise) || amountInPaise < 100) {
      return NextResponse.json({ error: 'Minimum amount is 100 paise (1 Rupee).' }, { status: 400 });
    }

    // 3. Initialize Razorpay Client
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      console.error('Razorpay credentials missing in environment.');
      return NextResponse.json({ error: 'Razorpay configuration error.' }, { status: 500 });
    }

    const razorpay = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });

    // 4. Call Razorpay API to create order
    const rzpOrder = await razorpay.orders.create({
      amount: amountInPaise,
      currency,
      receipt: receipt || `rcpt_${Date.now()}`,
    });

    // 5. Return success response
    return NextResponse.json({
      order_id: rzpOrder.id,
      amount: rzpOrder.amount,
      currency: rzpOrder.currency,
    });
  } catch (error: any) {
    console.error('Create order API error:', error);
    return NextResponse.json(
      { error: error.message || 'Razorpay order creation failed.' },
      { status: 500 }
    );
  }
}
