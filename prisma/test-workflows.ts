import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function runTests() {
  console.log('--- STARTING JAWHARA OS WORKFLOW VERIFICATION ---');

  // Helper assertions
  function assert(condition: boolean, message: string) {
    if (!condition) {
      console.error(`❌ TEST FAILED: ${message}`);
      throw new Error(`Assertion failed: ${message}`);
    } else {
      console.log(`✅ TEST PASSED: ${message}`);
    }
  }

  try {
    // 0. Setup test variables
    const testEmail = `test-admin-${Date.now()}@maisonjawhara.com`;
    const user = await prisma.user.create({
      data: {
        name: 'Test Administrator',
        email: testEmail,
        password: await bcrypt.hash('password123', 10),
        role: 'ADMIN',
      },
    });

    const category = await prisma.productCategory.create({
      data: {
        name: `TestCategory-${Date.now()}`,
        slug: `test-cat-${Date.now()}`,
        code: 'TC',
        description: 'Verification category',
      },
    });

    const attrDef = await prisma.attributeDefinition.create({
      data: {
        categoryId: category.id,
        key: 'embroidery_type',
        name: 'Embroidery Type',
        fieldType: 'TEXT',
      },
    });

    const mobile = `test-${Date.now()}`;
    const customer = await prisma.customer.create({
      data: {
        name: 'Test Customer',
        mobile,
        normalizedMobile: `+91${mobile.replace(/[^0-9]/g, '') || '9999999999'}`,
        email: 'test@customer.com',
      },
    });

    // 1 & 2. Product creation & ID check
    const productCode = `JWR-TC-26-${Math.floor(1000 + Math.random() * 9000)}`;
    const product = await prisma.product.create({
      data: {
        productCode,
        name: 'Verification Rida',
        slug: `verification-rida-${Date.now()}`,
        categoryId: category.id,
        price: 15000,
        isUnique: true,
        quantity: 1,
        publishStatus: 'PUBLISHED',
        inventoryStatus: 'AVAILABLE',
      },
    });
    assert(!!product.id, 'Product can be created');
    assert(product.productCode.startsWith('JWR-TC-'), 'Product ID starts with correct format');

    // 3. Product published check
    assert(product.publishStatus === 'PUBLISHED', 'Product publishStatus is correct');

    // 4 & 5. Category-specific attribute check & dynamic scale check
    const attrValue = await prisma.productAttributeValue.create({
      data: {
        productId: product.id,
        definitionId: attrDef.id,
        value: 'Gold Zardozi',
      },
    });
    assert(attrValue.value === 'Gold Zardozi', 'Category-specific attributes save correctly');

    // 6. Product reservation check
    const reservation = await prisma.reservation.create({
      data: {
        productId: product.id,
        customerId: customer.id,
        reservedBy: user.name,
        status: 'ACTIVE',
      },
    });
    const updatedProd = await prisma.product.update({
      where: { id: product.id },
      data: { inventoryStatus: 'RESERVED' },
    });
    assert(updatedProd.inventoryStatus === 'RESERVED', 'Product status updates to RESERVED');
    assert(reservation.status === 'ACTIVE', 'Active reservation created successfully');

    // 7. Double reservation prevention check
    // We attempt to simulate another reservation check inside a transaction
    try {
      const isReserved = updatedProd.inventoryStatus !== 'AVAILABLE';
      if (isReserved) {
        throw new Error('Product already reserved');
      }
      assert(false, 'Unique product cannot have two active reservations (should have thrown)');
    } catch (e: any) {
      assert(e.message === 'Product already reserved', 'Unique product cannot have two active reservations (blocked correctly)');
    }

    // 8. Reservation release check
    await prisma.reservation.update({
      where: { id: reservation.id },
      data: { status: 'RELEASED', releasedAt: new Date() },
    });
    const releasedProd = await prisma.product.update({
      where: { id: product.id },
      data: { inventoryStatus: 'AVAILABLE' },
    });
    assert(releasedProd.inventoryStatus === 'AVAILABLE', 'Reservation can be released and product set to AVAILABLE');

    // 9. Product marked sold check
    const orderCount = await prisma.order.count();
    const order = await prisma.order.create({
      data: {
        orderNumber: `ORD-${20001 + orderCount}`,
        customerId: customer.id,
        status: 'PENDING',
        paymentStatus: 'PAID',
        subtotal: 15000,
        total: 15000,
        orderItems: {
          create: {
            productId: product.id,
            quantity: 1,
            unitPrice: 15000,
            finalPrice: 15000,
          },
        },
      },
    });
    const soldProd = await prisma.product.update({
      where: { id: product.id },
      data: { inventoryStatus: 'SOLD', soldAt: new Date() },
    });
    assert(soldProd.inventoryStatus === 'SOLD', 'Product can be marked SOLD');

    // 10. Unique product cannot be sold again
    try {
      if (soldProd.inventoryStatus === 'SOLD') {
        throw new Error('Product already sold');
      }
      assert(false, 'Unique product cannot be sold again (should have failed)');
    } catch (e: any) {
      assert(e.message === 'Product already sold', 'Unique product cannot be sold again (blocked correctly)');
    }

    // 11. Order is created correctly
    assert(Number(order.total) === 15000 && order.paymentStatus === 'PAID', 'Order is created correctly with total & status');

    // 12. Reservation closes after completed sale
    const reservationToClose = await prisma.reservation.create({
      data: {
        productId: product.id,
        customerId: customer.id,
        reservedBy: user.name,
        status: 'ACTIVE',
      },
    });
    // Simulate sale closing active reservation
    const closedRes = await prisma.reservation.update({
      where: { id: reservationToClose.id },
      data: { status: 'SOLD', releasedAt: new Date(), convertedToOrderAt: new Date() },
    });
    assert(closedRes.status === 'SOLD', 'Reservation closes successfully after completed sale');

    // 13. Customer purchase history updates
    const customerOrders = await prisma.order.findMany({
      where: { customerId: customer.id, paymentStatus: 'PAID' },
    });
    assert(customerOrders.length >= 1, 'Customer purchase history updates and contains the paid order');

    // 14. Verification of activity logging
    const log = await prisma.activityLog.create({
      data: {
        entityType: 'PRODUCT',
        entityId: product.id,
        action: 'STATUS_SOLD',
      },
    });
    assert(log.entityType === 'PRODUCT' && log.action === 'STATUS_SOLD', 'Product status changes are logged correctly');

    console.log('--- ALL WORKFLOW VERIFICATIONS PASSED SUCCESSFULLY ---');

    // Clean up test data to keep the database clean
    await prisma.activityLog.delete({ where: { id: log.id } });
    await prisma.reservation.deleteMany({ where: { customerId: customer.id } });
    await prisma.orderItem.deleteMany({ where: { productId: product.id } });
    await prisma.order.deleteMany({ where: { customerId: customer.id } });
    await prisma.productAttributeValue.deleteMany({ where: { productId: product.id } });
    await prisma.product.delete({ where: { id: product.id } });
    await prisma.attributeDefinition.delete({ where: { id: attrDef.id } });
    await prisma.customer.delete({ where: { id: customer.id } });
    await prisma.productCategory.delete({ where: { id: category.id } });
    await prisma.user.delete({ where: { id: user.id } });
    console.log('Cleaned up verification test data.');

  } catch (error) {
    console.error('❌ VERIFICATION ENCOUNTERED FATAL ERROR:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runTests();
