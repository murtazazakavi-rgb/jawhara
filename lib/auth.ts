import { cookies } from 'next/headers';
import * as crypto from 'crypto';
import { prisma } from './prisma';

const ALGORITHM = 'aes-256-gcm';
const COOKIE_NAME = 'jawhara_session';

function getSecretKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('FATAL SECURITY ERROR: SESSION_SECRET environment variable is missing in production!');
    }
    return crypto.createHash('sha256').update('fallback-secret-key-must-be-32-chars-long-at-least-2026-very-long-key').digest();
  }
  return crypto.createHash('sha256').update(secret).digest();
}

export function encrypt(text: string): string {
  const iv = crypto.randomBytes(12);
  const key = getSecretKey();
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${encrypted}:${tag}`;
}

export function decrypt(cipherText: string): string {
  try {
    const [ivHex, encrypted, tagHex] = cipherText.split(':');
    if (!ivHex || !encrypted || !tagHex) return '';
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const key = getSecretKey();
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (e) {
    return '';
  }
}

export interface SessionPayload {
  userId: string;
  email: string;
  name: string;
  role: string;
  expires: string;
}

export async function setSession(user: { id: string; email: string; name: string; role: string }) {
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
  const payload: SessionPayload = {
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    expires: expiresAt.toISOString(),
  };

  const encrypted = encrypt(JSON.stringify(payload));
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, encrypted, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    expires: expiresAt,
    path: '/',
  });
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(COOKIE_NAME);
  if (!sessionCookie) return null;

  const decrypted = decrypt(sessionCookie.value);
  if (!decrypted) return null;

  try {
    const payload: SessionPayload = JSON.parse(decrypted);
    const expireDate = new Date(payload.expires);
    if (expireDate < new Date()) {
      return null;
    }
    return payload;
  } catch (e) {
    return null;
  }
}

export async function getCurrentUser() {
  const session = await getSession();
  if (!session) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, name: true, email: true, role: true },
  });

  return user;
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}
