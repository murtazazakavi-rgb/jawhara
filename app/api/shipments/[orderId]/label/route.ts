/**
 * GET /api/shipments/[orderId]/label
 * Fetches the shipping label URL for an order's active shipment.
 * Label URL is returned and stored; client can open/print it.
 * SECURITY: Raw Shiprocket label URLs from the API may contain tokens.
 * We proxy through this endpoint so the client never sees provider internals.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserWithCapability } from '@/lib/authz';
import { getDeliveryProvider } from '@/lib/delivery';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await params;

  const user = await getUserWithCapability('MANAGE_ORDERS');
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { shipments: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });

    if (!order) return NextResponse.json({ error: 'Order not found.' }, { status: 404 });

    const shipment = order.shipments[0];
    if (!shipment?.providerShipmentId) {
      return NextResponse.json(
        { error: 'No shipment has been booked for this order yet.' },
        { status: 404 }
      );
    }

    // Return cached label URL if available
    if (shipment.labelUrl) {
      return NextResponse.json({ labelUrl: shipment.labelUrl });
    }

    // Fetch from Shiprocket
    const provider = getDeliveryProvider('shiprocket');
    const result = await provider.generateLabel(shipment.providerShipmentId);

    if (!result.success || !result.labelUrl) {
      return NextResponse.json(
        { error: 'Shipping label is not yet available. Please try again in a moment.' },
        { status: 422 }
      );
    }

    // Cache the label URL
    await prisma.shipment.update({
      where: { id: shipment.id },
      data: { labelUrl: result.labelUrl },
    });

    return NextResponse.json({ labelUrl: result.labelUrl });
  } catch (err: any) {
    console.error('[shipment label] Error:', err);
    return NextResponse.json({ error: 'Could not fetch shipping label.' }, { status: 500 });
  }
}
