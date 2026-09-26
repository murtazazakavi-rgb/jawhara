/**
 * POST /api/webhooks/shiprocket
 *
 * Receives tracking update webhooks from Shiprocket.
 *
 * SECURITY:
 * - Validates the webhook token from the configured header key/value.
 *   Shiprocket allows you to set a custom header key + value in
 *   Settings → API → Webhooks. We use SHIPROCKET_WEBHOOK_TOKEN as the value.
 * - Fails closed in production — no token means rejected.
 * - Idempotent: duplicate events (same AWB + providerStatus + eventTime)
 *   are silently skipped.
 * - Never logs token values.
 * - Raw provider payloads stored in ShipmentEvent; sensitive data
 *   is not forwarded to clients.
 *
 * Shiprocket webhook setup:
 * 1. Go to Shiprocket Dashboard → Settings → API → Webhooks
 * 2. Enable the webhook toggle
 * 3. Set the callback URL to: https://your-domain/api/webhooks/shiprocket
 * 4. Set custom header: Key = "x-shiprocket-token", Value = SHIPROCKET_WEBHOOK_TOKEN
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { emitBusinessEvent } from '@/lib/domain/automation';
import {
  normalizeShipmentStatus,
  shipmentStatusToOrderStatus,
} from '@/lib/delivery/normalizeStatus';
import { WebhookProvider, WebhookStatus, ShipmentStatus } from '@prisma/client';

// The header key Shiprocket sends the custom token in
const WEBHOOK_TOKEN_HEADER = 'x-shiprocket-token';

function validateWebhookToken(request: Request): boolean {
  const configuredToken = process.env.SHIPROCKET_WEBHOOK_TOKEN;

  if (!configuredToken) {
    // Fail closed in production
    if (process.env.NODE_ENV === 'production') {
      console.error('[Shiprocket webhook] SHIPROCKET_WEBHOOK_TOKEN is not set. Rejecting.');
      return false;
    }
    // Development: allow if explicitly opted in
    if (process.env.ALLOW_INSECURE_SHIPROCKET_WEBHOOKS === 'true') {
      console.warn('[Shiprocket webhook] Accepting unauthenticated webhook in dev mode.');
      return true;
    }
    return false;
  }

  const receivedToken = request.headers.get(WEBHOOK_TOKEN_HEADER);
  if (!receivedToken) return false;

  // Constant-time comparison to prevent timing attacks
  if (receivedToken.length !== configuredToken.length) return false;
  let mismatch = 0;
  for (let i = 0; i < configuredToken.length; i++) {
    mismatch |= receivedToken.charCodeAt(i) ^ configuredToken.charCodeAt(i);
  }
  return mismatch === 0;
}

export async function POST(request: Request) {
  // ── 1. Validate webhook token ───────────────────────────────────────────────
  if (!validateWebhookToken(request)) {
    console.warn('[Shiprocket webhook] Rejected: invalid or missing token.');
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  let payload: any;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload.' }, { status: 400 });
  }

  // ── 2. Extract key fields from Shiprocket tracking payload ─────────────────
  // Shiprocket webhook payload structure (from their docs):
  // { awb: "...", current_status: "...", shipment_status: "...", ... }
  const awb: string | undefined = payload.awb ?? payload.awb_code;
  const providerStatus: string | undefined =
    payload.current_status ?? payload.shipment_status ?? payload.status;
  const eventTime: string | undefined =
    payload.updated_at ?? payload.event_time ?? payload.timestamp;
  const location: string | undefined = payload.location ?? payload.city;
  const description: string | undefined = payload.activity ?? payload.current_status;
  const providerOrderId: string | undefined =
    String(payload.order_id ?? payload.shiprocket_order_id ?? '');

  if (!awb || !providerStatus) {
    console.warn('[Shiprocket webhook] Missing awb or status in payload.');
    return NextResponse.json({ error: 'Missing required fields: awb, status.' }, { status: 400 });
  }

  // ── 3. Create WebhookEvent for idempotency ──────────────────────────────────
  // Idempotency key: AWB + status + event time (or hash of payload)
  const eventKey = `shiprocket:${awb}:${providerStatus}:${eventTime ?? Date.now()}`;
  try {
    await prisma.webhookEvent.create({
      data: {
        provider: WebhookProvider.SHIPROCKET,
        externalEventId: eventKey,
        eventType: providerStatus,
        payload: payload,
        status: WebhookStatus.RECEIVED,
      },
    });
  } catch (dbErr: any) {
    if (dbErr.code === 'P2002') {
      // Duplicate event — already processed
      return NextResponse.json({ success: true, message: 'Already processed.' });
    }
    throw dbErr;
  }

  try {
    // ── 4. Locate the Shipment by AWB ────────────────────────────────────────
    const shipment = await prisma.shipment.findUnique({ where: { awb } });

    if (!shipment) {
      console.warn(`[Shiprocket webhook] No shipment found for AWB: ${awb}`);
      await prisma.webhookEvent.update({
        where: { externalEventId: eventKey },
        data: { status: WebhookStatus.FAILED, error: `No shipment for AWB ${awb}` },
      });
      // Return 200 so Shiprocket doesn't retry — this is a legitimate unknown AWB
      return NextResponse.json({ success: true, message: 'AWB not recognized.' });
    }

    // ── 5. Normalize status ───────────────────────────────────────────────────
    const normalized = normalizeShipmentStatus(providerStatus);
    const parsedEventTime = eventTime ? new Date(eventTime) : new Date();

    // ── 6. Store ShipmentEvent (skip exact duplicates) ────────────────────────
    const existingEvent = await prisma.shipmentEvent.findFirst({
      where: {
        shipmentId: shipment.id,
        providerStatus,
        eventTime: parsedEventTime,
      },
    });

    if (!existingEvent) {
      await prisma.shipmentEvent.create({
        data: {
          shipmentId: shipment.id,
          providerStatus,
          normalizedStatus: normalized ?? undefined,
          location,
          description,
          eventTime: parsedEventTime,
          // Store raw payload for debugging — never forwarded to client
          rawPayload: payload,
        },
      });
    }

    // ── 7. Update Shipment status ─────────────────────────────────────────────
    const shipmentUpdate: Record<string, unknown> = {
      lastTrackingUpdateAt: new Date(),
    };

    if (normalized) {
      // Only update status if it's a "forward" progression
      const statusOrder: ShipmentStatus[] = [
        ShipmentStatus.CREATED,
        ShipmentStatus.READY_FOR_PICKUP,
        ShipmentStatus.PICKUP_REQUESTED,
        ShipmentStatus.PICKED_UP,
        ShipmentStatus.IN_TRANSIT,
        ShipmentStatus.OUT_FOR_DELIVERY,
        ShipmentStatus.DELIVERED,
      ];

      const currentIdx = statusOrder.indexOf(shipment.status as ShipmentStatus);
      const newIdx = statusOrder.indexOf(normalized as ShipmentStatus);

      // Always allow terminal states (DELIVERY_FAILED, RTO, CANCELLED)
      const isTerminal = ['DELIVERY_FAILED', 'RTO', 'CANCELLED'].includes(normalized);

      if (isTerminal || newIdx > currentIdx) {
        shipmentUpdate.status = normalized;
      }

      // Update specific timestamps
      if (normalized === 'PICKED_UP' && !shipment.pickedUpAt) {
        shipmentUpdate.pickedUpAt = parsedEventTime;
      }
      if (normalized === 'DELIVERED' && !shipment.deliveredAt) {
        shipmentUpdate.deliveredAt = parsedEventTime;
      }
    }

    await prisma.shipment.update({
      where: { id: shipment.id },
      data: shipmentUpdate,
    });

    // ── 8. Update Order status if appropriate ─────────────────────────────────
    if (normalized) {
      const orderStatus = shipmentStatusToOrderStatus(normalized as any);
      if (orderStatus) {
        const order = await prisma.order.findUnique({ where: { id: shipment.orderId } });
        // Only update order status forward — don't allow regression
        if (order) {
          await prisma.order.update({
            where: { id: shipment.orderId },
            data: { status: orderStatus as any },
          });

          // Activity log for significant transitions
          const significantStatuses = ['PICKED_UP', 'OUT_FOR_DELIVERY', 'DELIVERED', 'DELIVERY_FAILED'];
          if (significantStatuses.includes(normalized)) {
            await prisma.activityLog.create({
              data: {
                entityType: 'ORDER',
                entityId: shipment.orderId,
                action: `SHIPMENT_${normalized}`,
                metadata: JSON.stringify({ awb, location, courierName: shipment.courierName }),
              },
            });
          }

          // ── 9. Emit business events for customer notifications ─────────────
          if (normalized === 'PICKED_UP') {
            await emitBusinessEvent('SHIPMENT_PICKED_UP', {
              orderId: shipment.orderId,
              awb,
              courierName: shipment.courierName,
            });
          } else if (normalized === 'OUT_FOR_DELIVERY') {
            await emitBusinessEvent('SHIPMENT_OUT_FOR_DELIVERY', {
              orderId: shipment.orderId,
              awb,
              courierName: shipment.courierName,
            });
          } else if (normalized === 'DELIVERED') {
            await emitBusinessEvent('SHIPMENT_DELIVERED', {
              orderId: shipment.orderId,
              awb,
              courierName: shipment.courierName,
            });
          }
        }
      }
    }

    // ── 10. Mark webhook as processed ─────────────────────────────────────────
    await prisma.webhookEvent.update({
      where: { externalEventId: eventKey },
      data: { status: WebhookStatus.PROCESSED, processedAt: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[Shiprocket webhook] Handler error:', err);
    await prisma.webhookEvent.update({
      where: { externalEventId: eventKey },
      data: { status: WebhookStatus.FAILED, error: err.message },
    }).catch(() => {});
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
