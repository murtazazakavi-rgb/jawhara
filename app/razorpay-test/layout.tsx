import { notFound } from 'next/navigation';
import { getUserWithCapability } from '@/lib/authz';

export default async function RazorpayTestLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV === 'production') {
    notFound();
  }

  const user = await getUserWithCapability('MANAGE_SETTINGS');
  if (!user) {
    notFound();
  }

  return children;
}
