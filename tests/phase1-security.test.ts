import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import {
  createRazorpayWebhookEventId,
  insecureRazorpayWebhooksAreAllowed,
  mockPaymentsAreAllowed,
  verifyRazorpayWebhookSignature,
} from '../lib/security/payments.ts';

test('mock payments are always disabled in production', () => {
  assert.equal(mockPaymentsAreAllowed({ NODE_ENV: 'production', ALLOW_MOCK_PAYMENTS: 'true' }), false);
});

test('mock payments require an explicit development flag', () => {
  assert.equal(mockPaymentsAreAllowed({ NODE_ENV: 'development', ALLOW_MOCK_PAYMENTS: 'false' }), false);
  assert.equal(mockPaymentsAreAllowed({ NODE_ENV: 'development', ALLOW_MOCK_PAYMENTS: 'true' }), true);
});

test('insecure Razorpay webhooks are always disabled in production', () => {
  assert.equal(
    insecureRazorpayWebhooksAreAllowed({
      NODE_ENV: 'production',
      ALLOW_INSECURE_RAZORPAY_WEBHOOKS: 'true',
    }),
    false
  );
});

test('Razorpay webhook signatures are checked exactly', () => {
  const rawBody = JSON.stringify({ event: 'payment_link.paid' });
  const secret = 'test-secret';
  const signature = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

  assert.equal(verifyRazorpayWebhookSignature({ rawBody, signature, secret }), true);
  assert.equal(verifyRazorpayWebhookSignature({ rawBody, signature: `${signature.slice(0, -1)}0`, secret }), false);
});

test('Razorpay webhook fallback IDs are deterministic', () => {
  const rawBody = JSON.stringify({ event: 'payment_link.paid', payload: { id: 1 } });
  assert.equal(createRazorpayWebhookEventId(rawBody), createRazorpayWebhookEventId(rawBody));
  assert.equal(createRazorpayWebhookEventId(rawBody, 'evt_123'), 'razorpay:evt_123');
});
