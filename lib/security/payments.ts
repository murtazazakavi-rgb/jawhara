import crypto from 'crypto';

type PaymentEnvironment = Partial<
  Pick<NodeJS.ProcessEnv, 'NODE_ENV' | 'ALLOW_MOCK_PAYMENTS' | 'ALLOW_INSECURE_RAZORPAY_WEBHOOKS'>
>;

export function mockPaymentsAreAllowed(env: PaymentEnvironment = process.env): boolean {
  return env.NODE_ENV !== 'production' && env.ALLOW_MOCK_PAYMENTS === 'true';
}

export function insecureRazorpayWebhooksAreAllowed(
  env: PaymentEnvironment = process.env
): boolean {
  return env.NODE_ENV !== 'production' && env.ALLOW_INSECURE_RAZORPAY_WEBHOOKS === 'true';
}

export function verifyRazorpayWebhookSignature({
  rawBody,
  signature,
  secret,
}: {
  rawBody: string;
  signature: string;
  secret: string;
}): boolean {
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const receivedBuffer = Buffer.from(signature, 'utf8');
  const expectedBuffer = Buffer.from(expected, 'utf8');

  return (
    receivedBuffer.length === expectedBuffer.length &&
    crypto.timingSafeEqual(receivedBuffer, expectedBuffer)
  );
}

export function createRazorpayWebhookEventId(rawBody: string, payloadId?: unknown): string {
  if (typeof payloadId === 'string' && payloadId.trim()) {
    return `razorpay:${payloadId.trim()}`;
  }

  return `razorpay:${crypto.createHash('sha256').update(rawBody).digest('hex')}`;
}
