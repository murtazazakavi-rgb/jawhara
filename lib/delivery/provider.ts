/**
 * lib/delivery/provider.ts
 *
 * DeliveryProvider interface — the abstraction that all courier integrations
 * must implement. Allows swapping Shiprocket for Delhivery, Shadowfax, etc.
 * without touching order or fulfilment logic.
 */

import type {
  ServiceabilityParams,
  ServiceabilityResult,
  RateParams,
  AvailableCourier,
  CreateShipmentParams,
  CreateShipmentResult,
  AssignAWBParams,
  AWBResult,
  PickupParams,
  PickupResult,
  TrackingResult,
  CancelParams,
  CancelResult,
  LabelResult,
} from './types';

export interface DeliveryProvider {
  /** Check which couriers can service this pickup → delivery pincode route */
  checkServiceability(params: ServiceabilityParams): Promise<ServiceabilityResult>;

  /** Get rate and ETA estimates for available couriers */
  getRates(params: RateParams): Promise<AvailableCourier[]>;

  /** Create a shipment/order with the provider. Idempotent by jawaraOrderId. */
  createShipment(params: CreateShipmentParams): Promise<CreateShipmentResult>;

  /** Assign an AWB (Air Waybill) to a created shipment */
  assignAWB(params: AssignAWBParams): Promise<AWBResult>;

  /** Request pickup from the courier at the pickup location */
  requestPickup(params: PickupParams): Promise<PickupResult>;

  /** Get current tracking events for a shipment by AWB */
  getTracking(awb: string): Promise<TrackingResult>;

  /** Cancel a shipment. Best-effort — provider may not support all states. */
  cancelShipment(params: CancelParams): Promise<CancelResult>;

  /** Generate / fetch the shipping label PDF URL */
  generateLabel(shipmentId: string): Promise<LabelResult>;
}
