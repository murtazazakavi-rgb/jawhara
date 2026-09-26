/**
 * POST /api/shipments/[orderId]/cancel
 * Cancels a Shiprocket shipment for an order.
 * Only OWNER and ADMIN can cancel shipments.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserWithCapability } from '@/lib/authz';
import { getDeliveryProvider } from '@/lib/delivery';
import { ShipmentStatus } from '@prisma/client';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await params;

  // Cancellation is admin-only — more sensitive than just tracking
  const user = await getUserWithCapability('MANAGE_DELIVERY_SETTINGS');
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized. Only admins can cancel shipments.' }, { status: 401 });
  }

  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { shipments: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });

    if (!order) return NextResponse.json({ error: 'Order not found.' }, { status: 404 });

    const shipment = order.shipments[0];
    if (!shipment?.providerOrderId) {
      return NextResponse.json(
        { error: 'No provider shipment found for this order.' },
        { status: 404 }
      );
    }

    if (shipment.status === ShipmentStatus.CANCELLED) {
      return NextResponse.json({ success: true, message: 'Shipment is already cancelled.' });
    }

    if (shipment.status === ShipmentStatus.DELIVERED) {
      return NextResponse.json(
        { error: 'Cannot cancel a delivered shipment.' },
        { status: 422 }
      );
    }

    const provider = getDeliveryProvider('shiprocket');
    const result = await provider.cancelShipment({
      providerOrderIds: [shipment.providerOrderId],
    });

    // Update shipment regardless — if provider fails, mark locally
    await prisma.shipment.update({
      where: { id: shipment.id },
      data: {
        status: ShipmentStatus.CANCELLED,
        lastProviderError: result.success ? null : result.error,
      },
    });

    await prisma.activityLog.create({
      data: {
        entityType: 'ORDER',
        entityId: order.id,
        action: 'SHIPMENT_CANCELLED',
        userId: user.id,
        metadata: JSON.stringify({ shipmentId: shipment.id, providerSuccess: result.success }),
      },
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[shipment cancel] Error:', err);
    return NextResponse.json({ error: 'Could not cancel shipment.' }, { status: 500 });
  }
}
