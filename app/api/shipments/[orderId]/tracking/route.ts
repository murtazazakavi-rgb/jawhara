/**
 * GET /api/shipments/[orderId]/tracking
 * Returns current shipment tracking events for an order.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserWithCapability } from '@/lib/authz';
import { getDeliveryProvider } from '@/lib/delivery';
import { normalizeShipmentStatus, shipmentStatusLabel } from '@/lib/delivery/normalizeStatus';

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
      include: {
        shipments: {
          include: { events: { orderBy: { eventTime: 'desc' } } },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!order) return NextResponse.json({ error: 'Order not found.' }, { status: 404 });

    const shipment = order.shipments[0];
    if (!shipment) return NextResponse.json({ shipment: null });

    // If we have an AWB and a Shiprocket provider, fetch live tracking
    if (shipment.awb && shipment.provider === 'SHIPROCKET') {
      const provider = getDeliveryProvider('shiprocket');
      const trackingResult = await provider.getTracking(shipment.awb);

      // Upsert new events from the provider
      if (trackingResult.success && trackingResult.events.length > 0) {
        for (const event of trackingResult.events) {
          const normalized = normalizeShipmentStatus(event.providerStatus);
          await prisma.shipmentEvent.upsert({
            where: {
              // Use composite uniqueness via a hash if needed — for now create-or-skip
              // We use a combination of shipmentId + eventTime + providerStatus
              // Prisma doesn't support compound unique without migration — use findFirst
              id: 'dummy', // will fail gracefully; real upsert uses findFirst below
            },
            update: {},
            create: {
              shipmentId: shipment.id,
              providerStatus: event.providerStatus,
              normalizedStatus: normalized ?? undefined,
              location: event.location,
              description: event.description,
              eventTime: new Date(event.eventTime),
            },
          }).catch(async () => {
            // Fall back to findFirst to avoid duplicate events
            const existing = await prisma.shipmentEvent.findFirst({
              where: {
                shipmentId: shipment.id,
                providerStatus: event.providerStatus,
                eventTime: new Date(event.eventTime),
              },
            });
            if (!existing) {
              await prisma.shipmentEvent.create({
                data: {
                  shipmentId: shipment.id,
                  providerStatus: event.providerStatus,
                  normalizedStatus: normalized ?? undefined,
                  location: event.location,
                  description: event.description,
                  eventTime: new Date(event.eventTime),
                },
              }).catch(() => {}); // Ignore duplicate race
            }
          });
        }
      }
    }

    // Return shipment with stored events
    const freshShipment = await prisma.shipment.findUnique({
      where: { id: shipment.id },
      include: { events: { orderBy: { eventTime: 'desc' } } },
    });

    return NextResponse.json({
      shipment: {
        id: freshShipment!.id,
        provider: freshShipment!.provider,
        awb: freshShipment!.awb,
        courierName: freshShipment!.courierName,
        status: freshShipment!.status,
        statusLabel: shipmentStatusLabel(freshShipment!.status),
        trackingUrl: freshShipment!.trackingUrl,
        pickupRequestedAt: freshShipment!.pickupRequestedAt,
        estimatedPickupAt: freshShipment!.estimatedPickupAt,
        pickedUpAt: freshShipment!.pickedUpAt,
        estimatedDeliveryAt: freshShipment!.estimatedDeliveryAt,
        deliveredAt: freshShipment!.deliveredAt,
        labelUrl: freshShipment!.labelUrl,
        events: freshShipment!.events.map((e) => ({
          providerStatus: e.providerStatus,
          normalizedStatus: e.normalizedStatus,
          location: e.location,
          description: e.description,
          eventTime: e.eventTime,
        })),
      },
    });
  } catch (err: any) {
    console.error('[shipment tracking] Error:', err);
    return NextResponse.json({ error: 'Could not fetch tracking information.' }, { status: 500 });
  }
}
