import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { emitBusinessEvent } from '@/lib/domain/automation';
import { ReservationStatus, InventoryStatus } from '@prisma/client';

export async function GET(request: Request) {
  try {
    // 1. Enforce Cron Authorization Token check
    const authHeader = request.headers.get('Authorization');
    const cronSecret = process.env.CRON_SECRET || 'jawhara_cron_secret_2026';
    const expectedAuth = `Bearer ${cronSecret}`;

    if (authHeader !== expectedAuth) {
      console.warn('Unauthorized attempt to trigger cron holds release.');
      return new Response('Unauthorized', { status: 401 });
    }

    console.log('Cron: Starting active reservations expiration processor...');

    // 2. Fetch active reservations that have expired
    const expiredReservations = await prisma.reservation.findMany({
      where: {
        status: ReservationStatus.ACTIVE,
        expiresAt: { lt: new Date() },
      },
      include: { product: true },
    });

    console.log(`Cron: Found ${expiredReservations.length} expired reservations.`);

    const results = [];

    // 3. Process each release atomically
    for (const res of expiredReservations) {
      try {
        await prisma.$transaction(async (tx) => {
          // A. Mark reservation as EXPIRED
          await tx.reservation.update({
            where: { id: res.id },
            data: {
              status: ReservationStatus.EXPIRED,
              releasedAt: new Date(),
            },
          });

          // B. Revert product stock
          if (res.product.isUnique) {
            await tx.product.update({
              where: { id: res.productId },
              data: { inventoryStatus: InventoryStatus.AVAILABLE },
            });
          } else {
            await tx.product.update({
              where: { id: res.productId },
              data: { quantity: { increment: res.quantity } },
            });
          }

          // C. Log Activity
          await tx.activityLog.create({
            data: {
              entityType: 'RESERVATION',
              entityId: res.id,
              action: 'EXPIRED',
              metadata: JSON.stringify({ productId: res.productId, quantity: res.quantity }),
            },
          });
        });

        // D. Emit event
        await emitBusinessEvent('RESERVATION_EXPIRED', {
          reservationId: res.id,
          productId: res.productId,
          customerId: res.customerId,
        });

        results.push({ id: res.id, status: 'EXPIRED_SUCCESS' });
      } catch (err: any) {
        console.error(`Cron: Failed to release reservation ${res.id}:`, err);
        results.push({ id: res.id, status: 'FAILED', error: err.message });
      }
    }

    return NextResponse.json({ success: true, processed: results });
  } catch (error: any) {
    console.error('Cron process-holds handler error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
