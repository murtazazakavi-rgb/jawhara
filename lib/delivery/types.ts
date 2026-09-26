/**
 * lib/delivery/types.ts
 *
 * Shared types for the Jawhara delivery provider abstraction.
 * Keeps provider-specific details out of domain logic.
 */

// ─── Input Types ──────────────────────────────────────────────────────────────

export interface ServiceabilityParams {
  pickupPincode: string;
  deliveryPincode: string;
  weight: number;       // kg
  cod: boolean;
  orderValue?: number;  // INR — for COD limit validation
}

export interface RateParams extends ServiceabilityParams {
  length?: number;  // cm
  breadth?: number; // cm
  height?: number;  // cm
}

export interface ShipmentAddress {
  name: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  email?: string;
}

export interface ShipmentOrderItem {
  name: string;
  sku: string;
  units: number;
  sellingPrice: number;
  discount?: number;
  tax?: string;
  hsn?: string;
}

export interface CreateShipmentParams {
  jawaraOrderId: string;
  jawaraOrderNumber: string;

  // Pickup (sender)
  pickupLocationName: string;  // Registered Shiprocket pickup location name

  // Delivery (recipient)
  billingAddress: ShipmentAddress;
  shippingAddress: ShipmentAddress;

  // Items
  orderItems: ShipmentOrderItem[];

  // Financials
  subTotal: number;
  discount: number;
  total: number;
  paymentMethod: 'Prepaid' | 'COD';

  // Parcel
  weight: number;   // kg
  length: number;   // cm
  breadth: number;  // cm
  height: number;   // cm
}

export interface AssignAWBParams {
  shipmentId: string;     // Provider's shipment_id
  courierId?: number;     // If omitted, Shiprocket assigns recommended courier
}

export interface PickupParams {
  shipmentIds: string[];  // Array of provider shipment_ids
}

export interface CancelParams {
  providerOrderIds: string[];
}

// ─── Result Types ─────────────────────────────────────────────────────────────

export interface AvailableCourier {
  courierId: number;
  courierName: string;
  rate: number;
  estimatedDeliveryDays: number;
  cod: boolean;
}

export interface ServiceabilityResult {
  serviceable: boolean;
  couriers: AvailableCourier[];
  error?: string;
}

export interface CreateShipmentResult {
  success: boolean;
  providerOrderId?: string;
  providerShipmentId?: string;
  error?: string;
}

export interface AWBResult {
  success: boolean;
  awb?: string;
  courierId?: number;
  courierName?: string;
  error?: string;
}

export interface PickupResult {
  success: boolean;
  pickupScheduledAt?: string;
  estimatedPickupAt?: string;
  error?: string;
}

export interface TrackingEvent {
  providerStatus: string;
  location?: string;
  description?: string;
  eventTime: string; // ISO 8601
}

export interface TrackingResult {
  success: boolean;
  currentStatus?: string;
  events: TrackingEvent[];
  error?: string;
}

export interface CancelResult {
  success: boolean;
  error?: string;
}

export interface LabelResult {
  success: boolean;
  labelUrl?: string;
  error?: string;
}
