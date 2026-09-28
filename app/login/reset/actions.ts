'use server';

import { prisma } from '@/lib/prisma';
import { setCustomerSession } from '@/lib/clientAuth';
import { findCustomerByLoginIdentifier } from '@/lib/customerLookup';
import { sendWhatsAppMessage } from '@/lib/integrations/whatsapp/provider';
import { consumeResetCode, issueResetCode, RESET_CODE_TTL_MINUTES } from '@/lib/security/resetCode';
import { DEFAULT_CUSTOMER_PASSWORD, hashCustomerPassword } from '@/lib/security/customerPassword';

/**
 * Step 1: send a reset code to the WhatsApp number on the customer's account.
 * Always answers the same way so the form can't be used to discover which
 * emails or numbers have accounts.
 */
export async function requestPasswordResetAction(data: { identifier: string }) {
  if (!data.identifier?.trim()) {
    return { error: 'Enter your email or mobile number.' };
  }

  try {
    const customer = await findCustomerByLoginIdentifier(data.identifier);
    if (customer?.normalizedMobile) {
      const code = await issueResetCode(customer.normalizedMobile);
      if (code) {
        const res = await sendWhatsAppMessage({
          to: customer.normalizedMobile,
          type: 'text',
          text: {
            body:
              `Your Jawhara password reset code is *${code}*.\n\n` +
              `It expires in ${RESET_CODE_TTL_MINUTES} minutes. If you didn't ask for this, you can ignore this message.`,
          },
        });
        if (!res.success) {
          console.error('Password reset code could not be sent:', res.error);
        }
      }
    }
  } catch (error) {
    console.error('requestPasswordResetAction error:', error);
  }

  return { success: true };
}

/**
 * Step 2: check the code, set the new password and sign the customer in.
 */
export async function resetPasswordWithCodeAction(data: {
  identifier: string;
  code: string;
  newPassword: string;
}) {
  const newPassword = data.newPassword?.trim() ?? '';
  if (!/^\d{6}$/.test(data.code?.trim() ?? '')) {
    return { error: 'Enter the 6-digit code from WhatsApp.' };
  }
  if (newPassword.length < 6) {
    return { error: 'Use at least 6 characters for your new password.' };
  }
  if (newPassword === DEFAULT_CUSTOMER_PASSWORD) {
    return { error: 'Choose a password other than the starter password.' };
  }

  try {
    const customer = await findCustomerByLoginIdentifier(data.identifier);
    if (!customer?.normalizedMobile) {
      return { error: 'That code is not valid. Request a new one.' };
    }

    const result = await consumeResetCode(customer.normalizedMobile, data.code);
    if (result === 'invalid') {
      return { error: 'That code is not right. Check WhatsApp and try again.' };
    }
    if (result === 'expired') {
      return { error: 'That code has expired or been used too many times. Request a new one.', expired: true };
    }

    await prisma.customer.update({
      where: { id: customer.id },
      data: { password: await hashCustomerPassword(newPassword) },
    });

    await prisma.activityLog.create({
      data: {
        entityType: 'CUSTOMER',
        entityId: customer.id,
        action: 'PASSWORD_RESET',
        metadata: JSON.stringify({ via: 'WHATSAPP_CODE' }),
      },
    });

    await setCustomerSession({ id: customer.id, email: customer.email, name: customer.name });
    return { success: true };
  } catch (error) {
    console.error('resetPasswordWithCodeAction error:', error);
    return { error: 'Something went wrong. Please try again.' };
  }
}
