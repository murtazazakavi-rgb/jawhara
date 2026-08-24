import { Prisma } from '@prisma/client';

/**
 * Generates a concurrency-safe sequential code using SequenceCounter atomic updates.
 */
async function generateSequentialCode(
  tx: Prisma.TransactionClient,
  key: string,
  prefix: string,
  padLength: number,
  initialValue: number = 0
): Promise<string> {
  const counter = await tx.sequenceCounter.upsert({
    where: { key },
    update: { value: { increment: 1 } },
    create: { key, value: initialValue + 1 },
  });

  const paddedVal = counter.value.toString().padStart(padLength, '0');
  return `${prefix}${paddedVal}`;
}

/**
 * Generates a concurrency-safe sequential Product SKU: JWR-[CATEGORY]-[YY]-[SEQUENCE]
 * e.g., JWR-R-26-0001
 */
export async function generateProductSKU(
  tx: Prisma.TransactionClient,
  categoryId: string
): Promise<string> {
  const category = await tx.productCategory.findUnique({
    where: { id: categoryId },
  });
  if (!category) {
    throw new Error(`Category not found for ID: ${categoryId}`);
  }

  const catCode = category.code.toUpperCase();
  const yearLastTwo = new Date().getFullYear().toString().slice(-2); // "26" for 2026
  
  const key = `PRODUCT:${catCode}:20${yearLastTwo}`;
  const prefix = `JWR-${catCode}-${yearLastTwo}-`;

  return generateSequentialCode(tx, key, prefix, 4, 0);
}

/**
 * Generates a concurrency-safe sequential Order Number: ORD-[SEQUENCE] starting at 10001
 * e.g., ORD-10001
 */
export async function generateOrderNumber(
  tx: Prisma.TransactionClient
): Promise<string> {
  return generateSequentialCode(tx, 'ORDER', 'ORD-', 5, 10000);
}
