import { PrismaClient } from '@prisma/client';

function createPrismaClient() {
  return new PrismaClient({
    log: ['query'],
    // Customer password hashes never leave the server unless a query opts in
    // with `omit: { password: false }`.
    omit: { customer: { password: true } },
  });
}

const globalForPrisma = global as unknown as { prisma: ReturnType<typeof createPrismaClient> };

export const prisma =
  globalForPrisma.prisma || createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
