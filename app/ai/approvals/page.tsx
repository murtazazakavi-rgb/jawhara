import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { getUserWithCapability } from '@/lib/authz';
import AppShell from '@/components/AppShell';
import ApprovalsClient from './ApprovalsClient';

export const dynamic = 'force-dynamic';

export default async function ApprovalsPage() {
  const session = await getSession();
  if (!session) redirect('/admin/login');

  const user = await getUserWithCapability('USE_AI_ASSISTANT');
  if (!user) redirect('/orders');

  const sessionUser = {
    name: session.name,
    email: session.email,
    role: session.role,
  };

  return (
    <AppShell user={sessionUser}>
      <div className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop py-8">
        <ApprovalsClient />
      </div>
    </AppShell>
  );
}
