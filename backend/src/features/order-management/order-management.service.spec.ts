import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { OrderManagementService } from './order-management.service';

function makePrisma() {
  const orders: any[] = [];
  let seq = 0;
  return {
    orders,
    customer: {
      findUnique: jest.fn(async ({ where }: any) =>
        where.userId === 'cust-user' ? { id: 'cust-1', userId: 'cust-user' } : null),
    },
    vendorProfile: {
      findUnique: jest.fn(async ({ where }: any) =>
        where.userId === 'vend-user' ? { id: 'vend-1', userId: 'vend-user' } : null),
    },
    order: {
      create: jest.fn(async ({ data }: any) => {
        const o = { id: `o-${++seq}`, status: data.status, customerId: data.customerId, vendorId: data.vendorId };
        orders.push(o);
        return o;
      }),
      findUnique: jest.fn(async ({ where }: any) => orders.find((o) => o.id === where.id) ?? null),
      update: jest.fn(async ({ where, data }: any) => {
        const o = orders.find((x) => x.id === where.id);
        Object.assign(o, data);
        return o;
      }),
      findMany: jest.fn(async ({ where }: any) =>
        orders.filter((o) =>
          (!where.customerId || o.customerId === where.customerId) &&
          (!where.vendorId || o.vendorId === where.vendorId))),
    },
  };
}

describe('OrderManagementService', () => {
  const customer = { userId: 'cust-user', role: 'CUSTOMER' };
  const vendor = { userId: 'vend-user', role: 'VENDOR' };
  const otherVendor = { userId: 'other', role: 'VENDOR' };

  it('creates a pending order and lets the owning vendor confirm it', async () => {
    const prisma = makePrisma();
    const svc = new OrderManagementService(prisma as any);
    const created = await svc.createOrder(customer, {
      vendorId: 'vend-1',
      items: [{ description: 'Widget', quantity: 2, unitPrice: 9.5 }],
    });
    expect(created).toMatchObject({ status: 'pending', customerId: 'cust-1' });

    await expect(svc.confirmOrder(otherVendor, created.id, { estimatedDelivery: '2026-11-01' }))
      .rejects.toBeInstanceOf(ForbiddenException);

    const confirmed = await svc.confirmOrder(vendor, created.id, { estimatedDelivery: '2026-11-01' });
    expect(confirmed).toMatchObject({ id: created.id, status: 'confirmed' });

    const list = await svc.listOrders(customer);
    expect(list).toEqual([expect.objectContaining({ id: created.id, status: 'confirmed' })]);

    await expect(svc.confirmOrder(vendor, created.id, { estimatedDelivery: '2026-11-01' }))
      .rejects.toBeInstanceOf(ConflictException);
  });

  it('validates input', async () => {
    const svc = new OrderManagementService(makePrisma() as any);
    await expect(svc.createOrder(customer, {})).rejects.toBeInstanceOf(BadRequestException);
    await expect(svc.confirmOrder(vendor, 'x', { estimatedDelivery: 'nope' }))
      .rejects.toBeInstanceOf(BadRequestException);
  });
});
