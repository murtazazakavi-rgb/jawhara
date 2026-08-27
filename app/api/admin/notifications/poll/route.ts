import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    // 1. Verify user is authenticated and is admin/staff
    const user = await getCurrentUser();
    if (!user || (user.role !== 'OWNER' && user.role !== 'ADMIN' && user.role !== 'SALES')) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    // 2. Parse query parameters
    const { searchParams } = new URL(request.url);
    const sinceParam = searchParams.get('since');
    
    // Default to 15 seconds ago if not specified
    const since = sinceParam ? new Date(sinceParam) : new Date(Date.now() - 15000);

    if (isNaN(since.getTime())) {
      return NextResponse.json({ error: 'Invalid since timestamp format.' }, { status: 400 });
    }

    // 3. Fetch paid orders since the timestamp
    const orders = await prisma.order.findMany({
      where: {
        paymentStatus: 'PAID',
        updatedAt: {
          gt: since,
        },
      },
      include: {
        customer: {
          select: {
            name: true,
            email: true,
            mobile: true,
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    // 4. Fetch active reservations (holds) since the timestamp
    const holds = await prisma.reservation.findMany({
      where: {
        status: 'ACTIVE',
        reservedAt: {
          gt: since,
        },
      },
      include: {
        customer: {
          select: {
            name: true,
          },
        },
        product: {
          select: {
            name: true,
            productCode: true,
          },
        },
      },
      orderBy: {
        reservedAt: 'desc',
      },
    });

    // 5. Return JSON payload
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      orders: orders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        total: Number(o.total),
        customerName: o.customer.name,
        updatedAt: o.updatedAt.toISOString(),
      })),
      holds: holds.map((h) => ({
        id: h.id,
        customerName: h.customer.name,
        productName: h.product.name,
        productCode: h.product.productCode,
        reservedAt: h.reservedAt.toISOString(),
      })),
    });
  } catch (error: any) {
    console.error('Admin notifications polling error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error.' },
      { status: 500 }
    );
  }
}
