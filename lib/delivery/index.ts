/**
 * lib/delivery/index.ts
 *
 * Factory for creating the active delivery provider.
 * Reads DELIVERY_PROVIDER env var (default: shiprocket).
 *
 * Supported values:
 *   shiprocket  — ShiprocketProvider (production)
 *   manual      — no-op provider (local/manual courier)
 *
 * Add new providers here without touching order/fulfilment logic.
 */

import type { DeliveryProvider } from './provider';
import { ShiprocketProvider } from './shiprocket';

/**
 * No-op provider for manual/local courier — operations are performed
 * directly by staff and tracked manually in the Shipment record.
 */
class ManualDeliveryProvider implements DeliveryProvider {
  async checkServiceability() {
    return { serviceable: true, couriers: [] };
  }
  async getRates() {
    return [];
  }
  async createShipment() {
    return { success: true };
  }
  async assignAWB() {
    return { success: true };
  }
  async requestPickup() {
    return { success: true };
  }
  async getTracking() {
    return { success: true, events: [] };
  }
  async cancelShipment() {
    return { success: true };
  }
  async generateLabel() {
    return { success: false, error: 'Labels are not available for manual courier.' };
  }
}

export function getDeliveryProvider(
  mode?: string
): DeliveryProvider {
  const provider = mode ?? process.env.DELIVERY_PROVIDER ?? 'shiprocket';

  switch (provider) {
    case 'shiprocket':
      return new ShiprocketProvider();
    case 'manual':
    default:
      return new ManualDeliveryProvider();
  }
}

export { ShiprocketProvider } from './shiprocket';
export type { DeliveryProvider } from './provider';
export * from './types';
export * from './normalizeStatus';
