/**
 * One-off backfill: hashes every customer password still stored as plaintext.
 * Safe to re-run; rows that already hold a bcrypt hash are skipped.
 *
 * Dry run (default):  npx tsx scripts/hash-customer-passwords.ts
 * Apply changes:      npx tsx scripts/hash-customer-passwords.ts --apply
 *
 * Uses DATABASE_URL from the environment (e.g. `set -a; source .env; set +a`).
 */
import { PrismaClient } from '@prisma/client';
import { hashCustomerPassword } from '../lib/security/customerPassword';

const apply = process.argv.includes('--apply');
const prisma = new PrismaClient();

async function main() {
  const customers = await prisma.customer.findMany({
    select: { id: true, password: true },
  });
  const plaintext = customers.filter(c => !/^\$2[aby]\$\d{2}\$/.test(c.password));

  console.log(`${customers.length} customers, ${plaintext.length} with plaintext passwords.`);
  if (!apply) {
    console.log('Dry run only. Re-run with --apply to hash them.');
    return;
  }

  for (const [i, c] of plaintext.entries()) {
    await prisma.customer.update({
      where: { id: c.id },
      data: { password: await hashCustomerPassword(c.password) },
    });
    if ((i + 1) % 50 === 0) console.log(`  hashed ${i + 1}/${plaintext.length}`);
  }
  console.log(`Done. Hashed ${plaintext.length} passwords.`);
}

main()
  .catch(err => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
