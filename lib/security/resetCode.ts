import * as crypto from 'crypto';
import * as bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';

/**
 * One-time password-reset codes, stored in the OtpCode table keyed by the
 * customer's normalized mobile number.
 *
 * OtpCode has no attempts column, so the stored value is
 * "<bcrypt hash of the code>|<failed attempts>".
 */

export const RESET_CODE_TTL_MINUTES = 10;
export const RESET_CODE_RESEND_SECONDS = 60;
const MAX_ATTEMPTS = 5;

function encode(hash: string, attempts: number) {
  return `${hash}|${attempts}`;
}

function decode(stored: string) {
  const sep = stored.lastIndexOf('|');
  return { hash: stored.slice(0, sep), attempts: Number(stored.slice(sep + 1)) || 0 };
}

/**
 * Creates (or replaces) the reset code for a mobile number and returns the
 * plain code to send. Returns null if a code was issued too recently.
 */
export async function issueResetCode(mobile: string): Promise<string | null> {
  const existing = await prisma.otpCode.findUnique({ where: { mobile } });
  if (existing && Date.now() - existing.createdAt.getTime() < RESET_CODE_RESEND_SECONDS * 1000) {
    return null;
  }

  const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
  const stored = encode(await bcrypt.hash(code, 10), 0);
  const expiresAt = new Date(Date.now() + RESET_CODE_TTL_MINUTES * 60 * 1000);

  await prisma.otpCode.upsert({
    where: { mobile },
    update: { code: stored, createdAt: new Date(), expiresAt },
    create: { mobile, code: stored, expiresAt },
  });

  return code;
}

/**
 * Checks a code. A match consumes it; each miss counts towards the limit, and
 * the code is discarded after too many misses or once expired.
 */
export async function consumeResetCode(
  mobile: string,
  code: string
): Promise<'ok' | 'invalid' | 'expired'> {
  const record = await prisma.otpCode.findUnique({ where: { mobile } });
  if (!record) return 'expired';

  if (record.expiresAt < new Date()) {
    await prisma.otpCode.delete({ where: { mobile } }).catch(() => {});
    return 'expired';
  }

  const { hash, attempts } = decode(record.code);
  if (await bcrypt.compare(code.trim(), hash)) {
    await prisma.otpCode.delete({ where: { mobile } }).catch(() => {});
    return 'ok';
  }

  if (attempts + 1 >= MAX_ATTEMPTS) {
    await prisma.otpCode.delete({ where: { mobile } }).catch(() => {});
    return 'expired';
  }
  await prisma.otpCode.update({ where: { mobile }, data: { code: encode(hash, attempts + 1) } });
  return 'invalid';
}
