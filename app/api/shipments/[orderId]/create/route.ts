/**
 * POST /api/shipments/[orderId]/create
 *
 * Creates a Shiprocket shipment for a paid, packed order.
 * Idempotent — clicking "Arrange Pickup" twice does NOT create a duplicate.
 *
 * Required body:
 *   courierId?      - Selected courier (omit to let Shiprocket recommend)
 *   weight          - Parcel weight in kg
 *   length          - Parcel length in cm
 *   breadth         - Parcel breadth in cm
 *   height          - Parcel height in cm
 *   deliveryName    - Recipient name
 *   deliveryPhone   - Recipient phone
 *   deliveryAddress - Street address
 *   deliveryCity    - City
 *   deliveryState   - State
 *   deliveryPincode - Pincode
 *
 * SECURITY: Order payment status is validated server-side. Client cannot
 * supply payment state. Shiprocket credentials never exposed to client.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserWithCapability } from '@/lib/authz';
import { getDeliveryProvider } from '@/lib/delivery';
import { ShipmentStatus } from '@prisma/client';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await params;

  const user = await getUserWithCapability('MANAGE_ORDERS');
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const {
    courierId,
    weight,
    length,
    breadth,
    height,
    deliveryName,
    deliveryPhone,
    deliveryAddress,
    deliveryCity,
    deliveryState,
    deliveryPincode,
  } = body;

  // ── Validate parcel details ────────────────────────────────────────────────
  const validationErrors: string[] = [];
  if (!weight || weight <= 0) validationErrors.push('Parcel weight is required.');
  if (!length || length <= 0) validationErrors.push('Parcel length is required.');
  if (!breadth || breadth <= 0) validationErrors.push('Parcel breadth is required.');
  if (!height || height <= 0) validationErrors.push('Parcel height is required.');
  if (!deliveryName?.trim()) validationErrors.push('Recipient name is required.');
  if (!deliveryPhone?.trim()) validationErrors.push('Recipient phone is required.');
  if (!deliveryAddress?.trim()) validationErrors.push('Delivery address is required.');
  if (!deliveryCity?.trim()) validationErrors.push('Delivery city is required.');
  if (!deliveryState?.trim()) validationErrors.push('Delivery state is required.');
  if (!deliveryPincode?.trim()) validationErrors.push('Delivery pincode is required.');

  if (validationErrors.length > 0) {
    return NextResponse.json({ error: validationErrors.join(' ') }, { status: 422 });
  }

  try {
    // ── Load and validate order ──────────────────────────────────────────────
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        customer: true,
        orderItems: { include: { product: true } },
        shipments: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
    }

    // Validate payment — do not create shipments for unpaid orders
    if (order.paymentStatus !== 'PAID') {
      return NextResponse.json(
        { error: 'Pickup cannot be arranged because this order has not been paid.' },
        { status: 422 }
      );
    }

    // Idempotency — if a Shiprocket shipment already exists for this order
    const existingShipment = order.shipments[0];
    if (
      existingShipment &&
      existingShipment.provider === 'SHIPROCKET' &&
      existingShipment.providerShipmentId
    ) {
      return NextResponse.json({
        success: true,
        alreadyBooked: true,
        shipmentId: existingShipment.id,
        message: 'A shipment has already been booked for this order.',
      });
    }

    const pickupLocationName = await prisma.systemSetting
      .findUnique({ where: { key: 'shiprocket_pickup_location_name' } })
      .then((s) => s?.value ?? 'Primary');

    const pickupPincode = await prisma.systemSetting
      .findUnique({ where: { key: 'shiprocket_pickup_pincode' } })
      .then((s) => s?.value ?? '');

    if (!pickupPincode) {
      return NextResponse.json(
        { error: 'Pickup location is not configured. Please complete Delivery settings.' },
        { status: 422 }
      );
    }

    // ── Create or update the Shipment record with parcel details ─────────────
    const shipmentRecord = existingShipment
      ? await prisma.shipment.update({
          where: { id: existingShipment.id },
          data: {
            provider: 'SHIPROCKET',
            weight,
            length,
            breadth,
            height,
            status: ShipmentStatus.CREATED,
          },
        })
      : await prisma.shipment.create({
          data: {
            orderId: order.id,
            provider: 'SHIPROCKET',
            weight,
            length,
            breadth,
            height,
            status: ShipmentStatus.CREATED,
          },
        });

    // Save delivery address to order
    await prisma.order.update({
      where: { id: orderId },
      data: {
        deliveryName,
        deliveryPhone,
        deliveryAddress,
        deliveryCity,
        deliveryState,
        deliveryPincode,
      },
    });

    // ── Call Shiprocket API ──────────────────────────────────────────────────
    const provider = getDeliveryProvider('shiprocket');

    const shippingAddress = {
      name: deliveryName,
      phone: deliveryPhone,
      address: deliveryAddress,
      city: deliveryCity,
      state: deliveryState,
      pincode: deliveryPincode,
      email: order.customer.email ?? undefined,
    };

    const createResult = await provider.createShipment({
      jawaraOrderId: order.id,
      jawaraOrderNumber: order.orderNumber,
      pickupLocationName,
      billingAddress: shippingAddress,
      shippingAddress,
      orderItems: order.orderItems.map((item) => ({
        name: item.product.name,
        sku: item.product.productCode,
        units: item.quantity,
        sellingPrice: Number(item.finalPrice),
      })),
      subTotal: Number(order.subtotal),
      discount: Number(order.discount),
      total: Number(order.total),
      paymentMethod: 'Prepaid',
      weight: Number(weight),
      length: Number(length),
      breadth: Number(breadth),
      height: Number(height),
    });

    if (!createResult.success) {
      // Store the provider error for debugging — never expose raw Shiprocket error to client
      await prisma.shipment.update({
        where: { id: shipmentRecord.id },
        data: { lastProviderError: createResult.error },
      });
      await prisma.activityLog.create({
        data: {
          entityType: 'ORDER',
          entityId: order.id,
          action: 'SHIPMENT_PROVIDER_ERROR',
          userId: user.id,
          metadata: JSON.stringify({ step: 'createShipment', error: createResult.error }),
        },
      });
      return NextResponse.json(
        { error: 'Pickup could not be arranged. Please check the delivery address and try again.' },
        { status: 422 }
      );
    }

    // ── Assign AWB ───────────────────────────────────────────────────────────
    const awbResult = await provider.assignAWB({
      shipmentId: createResult.providerShipmentId!,
      courierId: courierId ? Number(courierId) : undefined,
    });

    if (!awbResult.success) {
      await prisma.shipment.update({
        where: { id: shipmentRecord.id },
        data: {
          providerOrderId: createResult.providerOrderId,
          providerShipmentId: createResult.providerShipmentId,
          lastProviderError: awbResult.error,
          status: ShipmentStatus.CREATED,
        },
      });
      return NextResponse.json(
        { error: 'Shipment was created but AWB assignment failed. Please try again.' },
        { status: 422 }
      );
    }

    // ── Request Pickup ───────────────────────────────────────────────────────
    const pickupResult = await provider.requestPickup({
      shipmentIds: [createResult.providerShipmentId!],
    });

    // Update shipment record with all provider details
    const updatedShipment = await prisma.shipment.update({
      where: { id: shipmentRecord.id },
      data: {
        providerOrderId: createResult.providerOrderId,
        providerShipmentId: createResult.providerShipmentId,
        courierId: awbResult.courierId,
        courierName: awbResult.courierName,
        awb: awbResult.awb,
        status: pickupResult.success
          ? ShipmentStatus.PICKUP_REQUESTED
          : ShipmentStatus.CREATED,
        pickupStatus: pickupResult.success ? 'SCHEDULED' : 'PENDING',
        pickupRequestedAt: pickupResult.success ? new Date() : null,
        estimatedPickupAt: pickupResult.estimatedPickupAt
          ? new Date(pickupResult.estimatedPickupAt)
          : null,
        lastProviderError: pickupResult.success ? null : pickupResult.error,
      },
    });

    // Update order status
    await prisma.order.update({
      where: { id: orderId },
      data: {
        status: pickupResult.success ? 'PICKUP_REQUESTED' : ('READY_FOR_PICKUP' as any),
      },
    });

    // Activity log
    await prisma.activityLog.create({
      data: {
        entityType: 'ORDER',
        entityId: order.id,
        action: 'SHIPMENT_CREATED',
        userId: user.id,
        metadata: JSON.stringify({
          shipmentId: updatedShipment.id,
          provider: 'SHIPROCKET',
          awb: awbResult.awb,
          courierName: awbResult.courierName,
          pickupRequested: pickupResult.success,
        }),
      },
    });

    return NextResponse.json({
      success: true,
      shipmentId: updatedShipment.id,
      awb: awbResult.awb,
      courierName: awbResult.courierName,
      pickupRequested: pickupResult.success,
      status: updatedShipment.status,
    });
  } catch (err: any) {
    console.error('[shipment create] Error:', err);
    return NextResponse.json(
      { error: 'An unexpected error occurred while arranging pickup. Please try again.' },
      { status: 500 }
    );
  }
}
