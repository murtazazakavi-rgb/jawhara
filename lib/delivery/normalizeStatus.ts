/**
 * lib/delivery/normalizeStatus.ts
 *
 * Maps Shiprocket and generic courier status strings to Jawhara's internal
 * ShipmentStatus enum values. Keeps provider-specific strings out of UI and
 * business logic.
 *
 * Add entries as new courier statuses are encountered.
 */

// These must match the ShipmentStatus enum in schema.prisma
export type NormalizedShipmentStatus =
  | 'CREATED'
  | 'READY_FOR_PICKUP'
  | 'PICKUP_REQUESTED'
  | 'PICKED_UP'
  | 'IN_TRANSIT'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'DELIVERY_FAILED'
  | 'RTO'
  | 'CANCELLED';

/**
 * Maps a raw Shiprocket/courier status string → NormalizedShipmentStatus.
 * Returns null if the status is not recognized (caller may log and skip).
 */
export function normalizeShipmentStatus(
  rawStatus: string
): NormalizedShipmentStatus | null {
  const s = rawStatus.trim().toUpperCase().replace(/[\s-]/g, '_');

  const mapping: Record<string, NormalizedShipmentStatus> = {
    // Shiprocket status strings (from webhook and tracking API)
    PICKUP_SCHEDULED: 'PICKUP_REQUESTED',
    PICKUP_QUEUED: 'PICKUP_REQUESTED',
    PICKUP_PENDING: 'PICKUP_REQUESTED',
    PICKUP_REQUESTED: 'PICKUP_REQUESTED',
    PICKUP_GENERATED: 'PICKUP_REQUESTED',
    OUT_FOR_PICKUP: 'PICKUP_REQUESTED',
    PICKED_UP: 'PICKED_UP',
    PICKUP_COMPLETE: 'PICKED_UP',
    SHIPMENT_PICKED_UP: 'PICKED_UP',

    IN_TRANSIT: 'IN_TRANSIT',
    TRANSIT: 'IN_TRANSIT',
    REACHED_AT_HUB: 'IN_TRANSIT',
    REACHED_AT_DESTINATION_HUB: 'IN_TRANSIT',
    SHIPMENT_BOOOKED: 'IN_TRANSIT', // Shiprocket typo — preserved
    SHIPMENT_BOOKED: 'IN_TRANSIT',

    OUT_FOR_DELIVERY: 'OUT_FOR_DELIVERY',
    OUT_FOR_DELIVERY_TODAY: 'OUT_FOR_DELIVERY',

    DELIVERED: 'DELIVERED',
    DELIVERED_TO_CUSTOMER: 'DELIVERED',

    UNDELIVERED: 'DELIVERY_FAILED',
    DELIVERY_ATTEMPTED: 'DELIVERY_FAILED',
    DELIVERY_FAILED: 'DELIVERY_FAILED',
    DELIVERY_EXCEPTION: 'DELIVERY_FAILED',
    NDR_RAISED: 'DELIVERY_FAILED',
    NDR: 'DELIVERY_FAILED',

    RTO: 'RTO',
    RTO_INITIATED: 'RTO',
    RETURN_TO_ORIGIN: 'RTO',
    RTO_IN_TRANSIT: 'RTO',
    RTO_OUT_FOR_DELIVERY: 'RTO',
    RTO_DELIVERED: 'RTO',

    CANCELLED: 'CANCELLED',
    CANCELLATION_REQUESTED: 'CANCELLED',

    CREATED: 'CREATED',
    NEW: 'CREATED',

    READY_FOR_PICKUP: 'READY_FOR_PICKUP',
    READY_TO_SHIP: 'READY_FOR_PICKUP',
  };

  return mapping[s] ?? null;
}

/**
 * Human-readable label for each normalized status — shown in the UI.
 */
export function shipmentStatusLabel(status: NormalizedShipmentStatus | string): string {
  const labels: Record<string, string> = {
    CREATED: 'Created',
    READY_FOR_PICKUP: 'Ready for Pickup',
    PICKUP_REQUESTED: 'Pickup Requested',
    PICKED_UP: 'Picked Up',
    IN_TRANSIT: 'In Transit',
    OUT_FOR_DELIVERY: 'Out for Delivery',
    DELIVERED: 'Delivered',
    DELIVERY_FAILED: 'Delivery Failed',
    RTO: 'Returning to Origin',
    CANCELLED: 'Cancelled',
  };
  return labels[status] ?? status;
}

/**
 * Which order statuses should be set when a shipment reaches each normalized state.
 * Returns null when the order status should not be updated.
 */
export function shipmentStatusToOrderStatus(
  status: NormalizedShipmentStatus
): string | null {
  const mapping: Partial<Record<NormalizedShipmentStatus, string>> = {
    PICKUP_REQUESTED: 'PICKUP_REQUESTED',
    PICKED_UP: 'DISPATCHED',
    IN_TRANSIT: 'IN_TRANSIT',
    OUT_FOR_DELIVERY: 'OUT_FOR_DELIVERY',
    DELIVERED: 'DELIVERED',
    DELIVERY_FAILED: 'DELIVERY_FAILED',
  };
  return mapping[status] ?? null;
}
