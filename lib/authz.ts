import { UserRole } from '@prisma/client';
import { getCurrentUser } from '@/lib/auth';

export type StaffCapability =
  | 'MANAGE_ORDERS'
  | 'MANAGE_SETTINGS'
  | 'MANAGE_CAMPAIGNS'
  | 'MANAGE_DELIVERY_SETTINGS'
  | 'USE_AI_ASSISTANT'
  | 'USE_WHATSAPP';

const CAPABILITY_ROLES: Record<StaffCapability, readonly UserRole[]> = {
  // Preserve the existing order workflow: every authenticated staff role can
  // manage orders, while configuration remains restricted below.
  MANAGE_ORDERS: [UserRole.OWNER, UserRole.ADMIN, UserRole.SALES],
  MANAGE_SETTINGS: [UserRole.OWNER, UserRole.ADMIN],
  MANAGE_CAMPAIGNS: [UserRole.OWNER, UserRole.ADMIN],
  // Delivery/Shiprocket credentials are admin-only
  MANAGE_DELIVERY_SETTINGS: [UserRole.OWNER, UserRole.ADMIN],
  USE_AI_ASSISTANT: [UserRole.OWNER, UserRole.ADMIN, UserRole.SALES],
  USE_WHATSAPP: [UserRole.OWNER, UserRole.ADMIN, UserRole.SALES],
};

export function roleHasCapability(role: UserRole, capability: StaffCapability): boolean {
  return CAPABILITY_ROLES[capability].includes(role);
}

export async function getUserWithCapability(capability: StaffCapability) {
  const user = await getCurrentUser();
  if (!user || !roleHasCapability(user.role, capability)) {
    return null;
  }

  return user;
}
