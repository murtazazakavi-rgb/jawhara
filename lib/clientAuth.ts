import { cookies } from 'next/headers';
import { encrypt, decrypt } from './auth';
import { prisma } from './prisma';

const CLIENT_COOKIE_NAME = 'jawhara_customer_session';

export interface CustomerSessionPayload {
  customerId: string;
  mobile: string;
  name: string;
  expires: string;
}

export async function setCustomerSession(customer: { id: string; mobile: string; name: string }) {
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days for customer convenience
  const payload: CustomerSessionPayload = {
    customerId: customer.id,
    mobile: customer.mobile,
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
  const sessionCookie = cookieStore.get(CLIENT_COOKIE_NAME);
  if (!sessionCookie) return null;

  const decrypted = decrypt(sessionCookie.value);
  if (!decrypted) return null;

  try {
    const payload: CustomerSessionPayload = JSON.parse(decrypted);
    const expireDate = new Date(payload.expires);
    if (expireDate < new Date()) {
      return null;
    }
    return payload;
  } catch (e) {
    return null;
  }
}

export async function getCurrentCustomer() {
  const session = await getCustomerSession();
  if (!session) return null;

  const customer = await prisma.customer.findUnique({
    where: { id: session.customerId },
  });

  if (!customer || customer.isArchived) return null;

  return customer;
}

export async function clearCustomerSession() {
  const cookieStore = await cookies();
  cookieStore.set(CLIENT_COOKIE_NAME, '', { maxAge: -1, path: '/' });
}
