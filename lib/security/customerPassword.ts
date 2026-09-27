import * as bcrypt from 'bcryptjs';

/** Legacy default password given to customers created without one. */
export const DEFAULT_CUSTOMER_PASSWORD = '123456';

const BCRYPT_ROUNDS = 10;

function isBcryptHash(stored: string) {
  return /^\$2[aby]\$\d{2}\$/.test(stored);
}

export function hashCustomerPassword(plain: string) {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

/**
 * Verifies a login attempt. Older rows still hold plaintext passwords, so
 * those are compared directly and flagged for rehashing on success.
 */
export async function verifyCustomerPassword(plain: string, stored: string) {
  if (isBcryptHash(stored)) {
    return { valid: await bcrypt.compare(plain, stored), needsRehash: false };
  }
  return { valid: plain === stored, needsRehash: plain === stored };
}

/** True while the customer is still on the default password (hashed or not). */
export async function isDefaultCustomerPassword(stored: string) {
  const { valid } = await verifyCustomerPassword(DEFAULT_CUSTOMER_PASSWORD, stored);
  return valid;
}
