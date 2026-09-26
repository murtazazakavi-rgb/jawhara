/**
 * lib/delivery/shiprocket.ts
 *
 * ShiprocketProvider — implements DeliveryProvider using the Shiprocket API v1.
 * Base URL: https://apiv2.shiprocket.in/v1/external
 *
 * Authentication: JWT token generated from email/password. Valid for 240 hours (10 days).
 * Token is cached in-memory with a safety margin of 1 hour before expiry.
 *
 * SECURITY: Credentials (email, password, token) are NEVER sent to the client.
 * All Shiprocket API calls are server-side only.
 */

import type { DeliveryProvider } from './provider';
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
  TrackingEvent,
  CancelParams,
  CancelResult,
  LabelResult,
} from './types';

const SHIPROCKET_BASE = 'https://apiv2.shiprocket.in/v1/external';
const TOKEN_VALIDITY_HOURS = 240;        // Shiprocket docs: 10 days
const TOKEN_REFRESH_MARGIN_HOURS = 1;    // Refresh 1 hour before expiry

interface CachedToken {
  token: string;
  expiresAt: Date;
}

// Module-level cache — persists across requests in the same Node.js process
let _tokenCache: CachedToken | null = null;

export class ShiprocketProvider implements DeliveryProvider {
  private email: string;
  private password: string;

  constructor() {
    this.email = process.env.SHIPROCKET_EMAIL ?? '';
    this.password = process.env.SHIPROCKET_PASSWORD ?? '';
  }

  private isConfigured(): boolean {
    return !!this.email && !!this.password;
  }

  // ── Authentication ──────────────────────────────────────────────────────────

  /**
   * Returns a valid Bearer token, refreshing from Shiprocket if needed.
   * Throws if credentials are missing or auth fails.
   */
  async getToken(): Promise<string> {
    if (!this.isConfigured()) {
      throw new Error(
        'Shiprocket is not configured. Please set SHIPROCKET_EMAIL and SHIPROCKET_PASSWORD.'
      );
    }

    const now = new Date();
    const refreshThreshold = new Date(
      now.getTime() + TOKEN_REFRESH_MARGIN_HOURS * 60 * 60 * 1000
    );

    if (_tokenCache && _tokenCache.expiresAt > refreshThreshold) {
      return _tokenCache.token;
    }

    console.log('[Shiprocket] Refreshing authentication token...');
    const res = await fetch(`${SHIPROCKET_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: this.email, password: this.password }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      console.error('[Shiprocket] Auth failed:', res.status, errBody);
      throw new Error(`Shiprocket authentication failed (${res.status}).`);
    }

    const data = await res.json();
    const token: string = data.token;

    if (!token) {
      throw new Error('Shiprocket authentication response did not include a token.');
    }

    const expiresAt = new Date(
      now.getTime() + (TOKEN_VALIDITY_HOURS - TOKEN_REFRESH_MARGIN_HOURS) * 60 * 60 * 1000
    );

    _tokenCache = { token, expiresAt };
    console.log(`[Shiprocket] Token cached. Expires: ${expiresAt.toISOString()}`);
    return token;
  }

  private async authorizedFetch(
    path: string,
    options: RequestInit = {}
  ): Promise<Response> {
    const token = await this.getToken();
    return fetch(`${SHIPROCKET_BASE}${path}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(options.headers ?? {}),
      },
    });
  }

  // ── Serviceability ──────────────────────────────────────────────────────────

  async checkServiceability(params: ServiceabilityParams): Promise<ServiceabilityResult> {
    try {
      const qs = new URLSearchParams({
        pickup_postcode: params.pickupPincode,
        delivery_postcode: params.deliveryPincode,
        weight: String(params.weight),
        cod: params.cod ? '1' : '0',
        ...(params.orderValue !== undefined
          ? { order_amount: String(params.orderValue) }
          : {}),
      });

      const res = await this.authorizedFetch(`/courier/serviceability/?${qs.toString()}`);

      if (!res.ok) {
        const err = await res.text();
        return { serviceable: false, couriers: [], error: `Serviceability check failed (${res.status}).` };
      }

      const data = await res.json();
      const courierData = data?.data?.available_courier_companies ?? [];

      const couriers: AvailableCourier[] = courierData.map((c: any) => ({
        courierId: c.courier_company_id,
        courierName: c.courier_name ?? c.name,
        rate: Number(c.rate ?? c.freight_charge ?? 0),
        estimatedDeliveryDays: Number(c.estimated_delivery_days ?? c.etd ?? 0),
        cod: Boolean(c.cod ?? false),
      }));

      return { serviceable: couriers.length > 0, couriers };
    } catch (err: any) {
      console.error('[Shiprocket] checkServiceability error:', err);
      return { serviceable: false, couriers: [], error: err.message };
    }
  }

  async getRates(params: RateParams): Promise<AvailableCourier[]> {
    const result = await this.checkServiceability(params);
    return result.couriers;
  }

  // ── Create Shipment ─────────────────────────────────────────────────────────

  async createShipment(params: CreateShipmentParams): Promise<CreateShipmentResult> {
    try {
      const body = {
        order_id: params.jawaraOrderNumber,  // Shiprocket uses this as their order_id
        order_date: new Date().toISOString().split('T')[0],
        pickup_location: params.pickupLocationName,
        billing_customer_name: params.billingAddress.name,
        billing_last_name: '',
        billing_address: params.billingAddress.address,
        billing_city: params.billingAddress.city,
        billing_pincode: params.billingAddress.pincode,
        billing_state: params.billingAddress.state,
        billing_country: 'India',
        billing_email: params.billingAddress.email ?? '',
        billing_phone: params.billingAddress.phone,
        shipping_is_billing: false,
        shipping_customer_name: params.shippingAddress.name,
        shipping_last_name: '',
        shipping_address: params.shippingAddress.address,
        shipping_city: params.shippingAddress.city,
        shipping_pincode: params.shippingAddress.pincode,
        shipping_country: 'India',
        shipping_state: params.shippingAddress.state,
        shipping_email: params.shippingAddress.email ?? '',
        shipping_phone: params.shippingAddress.phone,
        order_items: params.orderItems.map((item) => ({
          name: item.name,
          sku: item.sku,
          units: item.units,
          selling_price: item.sellingPrice,
          discount: item.discount ?? 0,
          tax: item.tax ?? '',
          hsn: item.hsn ?? '',
        })),
        payment_method: params.paymentMethod,
        shipping_charges: 0,
        giftwrap_charges: 0,
        transaction_charges: 0,
        total_discount: params.discount,
        sub_total: params.subTotal,
        length: params.length,
        breadth: params.breadth,
        height: params.height,
        weight: params.weight,
      };

      const res = await this.authorizedFetch('/orders/create/adhoc', {
        method: 'POST',
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        const message =
          data?.message ??
          (Array.isArray(data?.errors) ? data.errors.join(', ') : JSON.stringify(data));
        console.error('[Shiprocket] createShipment failed:', res.status, message);
        return { success: false, error: message };
      }

      // Shiprocket response may include order_id and shipment_id directly
      const providerOrderId = String(data.order_id ?? data.payload?.order_id ?? '');
      const providerShipmentId = String(data.shipment_id ?? data.payload?.shipment_id ?? '');

      return {
        success: true,
        providerOrderId: providerOrderId || undefined,
        providerShipmentId: providerShipmentId || undefined,
      };
    } catch (err: any) {
      console.error('[Shiprocket] createShipment error:', err);
      return { success: false, error: err.message };
    }
  }

  // ── Assign AWB ──────────────────────────────────────────────────────────────

  async assignAWB(params: AssignAWBParams): Promise<AWBResult> {
    try {
      const body: Record<string, unknown> = {
        shipment_id: [params.shipmentId],
      };
      if (params.courierId) {
        body.courier_id = params.courierId;
      }

      const res = await this.authorizedFetch('/courier/assign/awb', {
        method: 'POST',
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        const message = data?.message ?? JSON.stringify(data);
        console.error('[Shiprocket] assignAWB failed:', res.status, message);
        return { success: false, error: message };
      }

      // Shiprocket returns assignment details in data.response.data
      const assignment = data?.response?.data ?? data;
      const awb = assignment?.awb_code ?? assignment?.awb ?? '';
      const courierId = assignment?.courier_company_id ?? assignment?.courier_id;
      const courierName = assignment?.courier_name ?? '';

      if (!awb) {
        return { success: false, error: 'AWB not returned by Shiprocket.' };
      }

      return {
        success: true,
        awb,
        courierId: courierId ? Number(courierId) : undefined,
        courierName: courierName || undefined,
      };
    } catch (err: any) {
      console.error('[Shiprocket] assignAWB error:', err);
      return { success: false, error: err.message };
    }
  }

  // ── Request Pickup ──────────────────────────────────────────────────────────

  async requestPickup(params: PickupParams): Promise<PickupResult> {
    try {
      const res = await this.authorizedFetch('/courier/generate/pickup', {
        method: 'POST',
        body: JSON.stringify({ shipment_id: params.shipmentIds }),
      });

      const data = await res.json();

      if (!res.ok) {
        const message = data?.message ?? JSON.stringify(data);
        console.error('[Shiprocket] requestPickup failed:', res.status, message);
        return { success: false, error: message };
      }

      const pickupData = data?.response ?? data;
      const pickupStatus = pickupData?.pickup_scheduled_date;

      return {
        success: true,
        pickupScheduledAt: pickupStatus ?? undefined,
        estimatedPickupAt: pickupStatus ?? undefined,
      };
    } catch (err: any) {
      console.error('[Shiprocket] requestPickup error:', err);
      return { success: false, error: err.message };
    }
  }

  // ── Tracking ────────────────────────────────────────────────────────────────

  async getTracking(awb: string): Promise<TrackingResult> {
    try {
      const res = await this.authorizedFetch(
        `/courier/track/awb/${encodeURIComponent(awb)}`
      );

      const data = await res.json();

      if (!res.ok) {
        return { success: false, events: [], error: `Tracking failed (${res.status}).` };
      }

      const trackingData = data?.tracking_data ?? data;
      const shipmentTrack = trackingData?.shipment_track?.[0] ?? {};
      const shipmentEvents: any[] = trackingData?.shipment_track_activities ?? [];

      const currentStatus: string = shipmentTrack?.current_status ?? '';

      const events: TrackingEvent[] = shipmentEvents.map((e: any) => ({
        providerStatus: e.activity ?? e.status ?? '',
        location: e.location ?? '',
        description: e.activity ?? e.description ?? '',
        eventTime: e.date ?? new Date().toISOString(),
      }));

      return { success: true, currentStatus, events };
    } catch (err: any) {
      console.error('[Shiprocket] getTracking error:', err);
      return { success: false, events: [], error: err.message };
    }
  }

  // ── Cancel Shipment ─────────────────────────────────────────────────────────

  async cancelShipment(params: CancelParams): Promise<CancelResult> {
    try {
      const res = await this.authorizedFetch('/orders/cancel', {
        method: 'POST',
        body: JSON.stringify({ ids: params.providerOrderIds }),
      });

      const data = await res.json();

      if (!res.ok) {
        const message = data?.message ?? JSON.stringify(data);
        return { success: false, error: message };
      }

      return { success: true };
    } catch (err: any) {
      console.error('[Shiprocket] cancelShipment error:', err);
      return { success: false, error: err.message };
    }
  }

  // ── Generate Label ──────────────────────────────────────────────────────────

  async generateLabel(shipmentId: string): Promise<LabelResult> {
    try {
      const res = await this.authorizedFetch('/courier/generate/label', {
        method: 'POST',
        body: JSON.stringify({ shipment_id: [shipmentId] }),
      });

      const data = await res.json();

      if (!res.ok) {
        const message = data?.message ?? JSON.stringify(data);
        return { success: false, error: message };
      }

      const labelUrl: string =
        data?.label_url ?? data?.response?.label_url ?? data?.label ?? '';

      if (!labelUrl) {
        return { success: false, error: 'Label URL not returned by Shiprocket.' };
      }

      return { success: true, labelUrl };
    } catch (err: any) {
      console.error('[Shiprocket] generateLabel error:', err);
      return { success: false, error: err.message };
    }
  }
}
