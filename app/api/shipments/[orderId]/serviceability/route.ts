/**
 * GET /api/shipments/[orderId]/serviceability
 *
 * Checks Shiprocket courier serviceability for a given order.
 * Returns available courier options with rates and ETAs.
 *
 * SECURITY: Shiprocket credentials are server-side only. Response is
 * sanitized to only include courier name, rate, and ETA — no tokens.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserWithCapability } from '@/lib/authz';
import { getDeliveryProvider } from '@/lib/delivery';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await params;

  const user = await getUserWithCapability('MANAGE_ORDERS');
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        shipments: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
    }

    // Require delivery address on the order
    if (!order.deliveryPincode) {
      return NextResponse.json(
        { error: 'Delivery pincode is required before checking serviceability.' },
        { status: 422 }
      );
    }

    const pickupPincode = await prisma.systemSetting
      .findUnique({ where: { key: 'shiprocket_pickup_pincode' } })
      .then((s) => s?.value ?? '');

    if (!pickupPincode) {
      return NextResponse.json(
        { error: 'Pickup pincode is not configured. Please set it in Settings → Delivery.' },
        { status: 422 }
      );
    }

    // Get the shipment weight from the existing shipment record if available
    const existingShipment = order.shipments[0];
    const weight = existingShipment?.weight ? Number(existingShipment.weight) : 0.5;

    const provider = getDeliveryProvider();
    const result = await provider.checkServiceability({
      pickupPincode,
      deliveryPincode: order.deliveryPincode,
      weight,
      cod: false, // Jawhara uses prepaid only
      orderValue: Number(order.total),
    });

    if (!result.serviceable && result.error) {
      return NextResponse.json(
        { error: 'This delivery location may not be serviceable. Please verify the pincode.' },
        { status: 422 }
      );
    }

    return NextResponse.json({
      serviceable: result.serviceable,
      couriers: result.couriers.map((c) => ({
        courierId: c.courierId,
        courierName: c.courierName,
        rate: c.rate,
        estimatedDeliveryDays: c.estimatedDeliveryDays,
      })),
    });
  } catch (err: any) {
    console.error('[serviceability] Error:', err);
    return NextResponse.json(
      { error: 'Could not check serviceability. Please try again.' },
      { status: 500 }
    );
  }
}
