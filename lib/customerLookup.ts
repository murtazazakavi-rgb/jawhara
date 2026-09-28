import { prisma } from '@/lib/prisma';
import { normalizePhoneNumber } from '@/lib/phone';

/**
 * Finds an active customer by email or mobile number, as typed on the login
 * or password-reset forms. Includes the password hash for verification.
 */
export async function findCustomerByLoginIdentifier(identifier: string) {
  const value = identifier.trim();
  if (!value) return null;

  const customer = value.includes('@')
    ? await prisma.customer.findUnique({
        where: { email: value.toLowerCase() },
        omit: { password: false },
      })
    : await prisma.customer.findUnique({
        where: { normalizedMobile: normalizePhoneNumber(value) },
        omit: { password: false },
      });

  return customer && !customer.isArchived ? customer : null;
}
