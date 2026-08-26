'use server';

import { prisma } from '@/lib/prisma';
import { setSession } from '@/lib/auth';
import * as bcrypt from 'bcryptjs';

export async function login(prevState: any, formData: FormData) {
  const username = formData.get('username') as string;
  const password = formData.get('password') as string;

  if (!username || !password) {
    return { error: 'Please enter both username/email and password.' };
  }

  try {
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: username },
          { name: username }
        ]
      }
    });

    if (!user) {
      return { error: 'Invalid credentials.' };
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return { error: 'Invalid credentials.' };
    }

    await setSession(user);
    return { success: true };
  } catch (e) {
    return { error: 'An unexpected error occurred. Please try again.' };
  }
}

export async function logout() {
  const { clearSession } = await import('@/lib/auth');
  await clearSession();
}
