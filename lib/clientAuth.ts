import { cookies, headers } from 'next/headers';
import { encrypt, decrypt } from './auth';
import { prisma } from './prisma';

const CLIENT_COOKIE_NAME = 'jawhara_customer_session';

export interface CustomerSessionPayload {
  customerId: string;
  email: string;
  name: string;
  expires: string;
}

export async function setCustomerSession(customer: { id: string; email: string; name: string }) {
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days for customer convenience
  const payload: CustomerSessionPayload = {
    customerId: customer.id,
    email: customer.email,
    name: customer.name,
    expires: expiresAt.toISOString(),
  };

  const encrypted = encrypt(JSON.stringify(payload));
  const cookieStore = await cookies();
  cookieStore.set(CLIENT_COOKIE_NAME, encrypted, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    expires: expiresAt,
    path: '/',
  });
}

export async function getCustomerSession(): Promise<CustomerSessionPayload | null> {
  const cookieStore = await cookies();
  console.log('[DEBUG AUTH] getCustomerSession: All cookies in store:', cookieStore.getAll().map(c => c.name));
  let sessionCookieValue = cookieStore.get(CLIENT_COOKIE_NAME)?.value;

  // Fallback: Parse from raw headers Cookie if cookies() returns empty
  if (!sessionCookieValue) {
    console.log('[DEBUG AUTH] getCustomerSession: Cookie not found in cookies(), trying headers()...');
    try {
      const reqHeaders = await headers();
      const rawCookie = reqHeaders.get('cookie');
      if (rawCookie) {
        const cookiesMap = new Map<string, string>();
        rawCookie.split(';').forEach(c => {
          const parts = c.split('=');
          const name = parts[0]?.trim();
          const value = parts.slice(1).join('=')?.trim();
          if (name && value) {
            cookiesMap.set(name, value);
          }
        });
        sessionCookieValue = cookiesMap.get(CLIENT_COOKIE_NAME);
        if (sessionCookieValue) {
          console.log('[DEBUG AUTH] getCustomerSession: Found cookie value in headers() fallback!');
        }
      }
    } catch (headerErr) {
      console.error('[DEBUG AUTH] getCustomerSession: Failed to read headers() fallback', headerErr);
    }
  }

  if (!sessionCookieValue) {
    console.log('[DEBUG AUTH] getCustomerSession: No session cookie value found anywhere');
    return null;
  }

  const decrypted = decrypt(sessionCookieValue);
  if (!decrypted) {
    console.log('[DEBUG AUTH] getCustomerSession: Decryption failed');
    return null;
  }

  try {
    const payload: CustomerSessionPayload = JSON.parse(decrypted);
    const expireDate = new Date(payload.expires);
    if (expireDate < new Date()) {
      console.log('[DEBUG AUTH] getCustomerSession: Cookie expired');
      return null;
    }
    return payload;
  } catch (e) {
    console.log('[DEBUG AUTH] getCustomerSession: JSON parse error', e);
    return null;
  }
}

export async function getCurrentCustomer() {
  const session = await getCustomerSession();
  if (!session) {
    console.log('[DEBUG AUTH] getCurrentCustomer: No session payload');
    return null;
  }

  const customer = await prisma.customer.findUnique({
    where: { id: session.customerId },
  });

  if (!customer) {
    console.log('[DEBUG AUTH] getCurrentCustomer: Customer not found in DB:', session.customerId);
    return null;
  }

  if (customer.isArchived) {
    console.log('[DEBUG AUTH] getCurrentCustomer: Customer is archived');
    return null;
  }

  return customer;
}

export async function clearCustomerSession() {
  const cookieStore = await cookies();
  cookieStore.delete(CLIENT_COOKIE_NAME);
}
