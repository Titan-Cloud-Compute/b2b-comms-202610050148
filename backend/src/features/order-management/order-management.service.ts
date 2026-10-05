import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FeatureService } from '../../common/feature';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  GetApiOrdersResponseDto,
  OrderItemInputDto,
  PatchApiOrdersIdConfirmResponseDto,
  PostApiOrdersResponseDto,
} from './order-management.dto';

export interface OrderActor {
  userId: string;
  role: string;
}

@Injectable()
export class OrderManagementService extends FeatureService {
  constructor(prisma: PrismaService) {
    super(prisma, ['Order', 'OrderItem']);
  }

  /** Customer places a purchase order; stored as "pending". */
  async createOrder(actor: OrderActor, body: unknown): Promise<PostApiOrdersResponseDto> {
    const b = (body ?? {}) as { vendorId?: unknown; items?: unknown };
    if (typeof b.vendorId !== 'string' || !b.vendorId.trim()) {
      throw new BadRequestException('vendorId is required');
    }
    const items = Array.isArray(b.items) ? (b.items as OrderItemInputDto[]) : [];
    for (const it of items) {
      if (
        !it ||
        typeof it.description !== 'string' ||
        !it.description.trim() ||
        !Number.isInteger(Number(it.quantity)) ||
        Number(it.quantity) <= 0 ||
        !Number.isFinite(Number(it.unitPrice)) ||
        Number(it.unitPrice) < 0
      ) {
        throw new BadRequestException('each item needs description, quantity > 0 and unitPrice >= 0');
      }
    }
    const customer = await this.model('Customer').findUnique({ where: { userId: actor.userId } });
    if (!customer) throw new ForbiddenException('only customers can place orders');

    const order = await this.model('Order').create({
      data: {
        status: 'pending',
        customerId: customer.id,
        vendorId: b.vendorId,
        orderItems: {
          create: items.map((it) => ({
            description: it.description,
            quantity: Number(it.quantity),
            unitPrice: Number(it.unitPrice),
          })),
        },
      },
    });
    return { id: order.id, status: order.status, customerId: order.customerId, vendorId: order.vendorId };
  }

  /** Vendor confirms one of its own pending orders. */
  async confirmOrder(
    actor: OrderActor,
    id: string,
    body: unknown,
  ): Promise<PatchApiOrdersIdConfirmResponseDto> {
    const b = (body ?? {}) as { estimatedDelivery?: unknown };
    const est = typeof b.estimatedDelivery === 'string' ? new Date(b.estimatedDelivery) : null;
    if (!est || Number.isNaN(est.getTime())) {
      throw new BadRequestException('estimatedDelivery must be a valid date');
    }
    const order = await this.model('Order').findUnique({ where: { id } });
    if (!order) throw new NotFoundException('order not found');
    if (actor.role !== 'ADMIN') {
      const vendor = await this.model('VendorProfile').findUnique({ where: { userId: actor.userId } });
      if (!vendor || vendor.id !== order.vendorId) {
        throw new ForbiddenException('order belongs to another vendor');
      }
    }
    if (order.status !== 'pending') throw new ConflictException('order is not pending');
    const updated = await this.model('Order').update({ where: { id }, data: { status: 'confirmed' } });
    return {
      id: updated.id,
      status: updated.status,
      estimatedDelivery: est.toISOString().slice(0, 10),
    };
  }

  /** Customers see their own orders, vendors see orders addressed to them, admins see all. */
  async listOrders(actor: OrderActor): Promise<GetApiOrdersResponseDto[]> {
    let where: { customerId?: string; vendorId?: string } = {};
    if (actor.role === 'CUSTOMER') {
      const customer = await this.model('Customer').findUnique({ where: { userId: actor.userId } });
      if (!customer) return [];
      where = { customerId: customer.id };
    } else if (actor.role === 'VENDOR') {
      const vendor = await this.model('VendorProfile').findUnique({ where: { userId: actor.userId } });
      if (!vendor) return [];
      where = { vendorId: vendor.id };
    } else if (actor.role !== 'ADMIN') {
      throw new ForbiddenException('not allowed to list orders');
    }
    const orders = await this.model('Order').findMany({ where, orderBy: { createdAt: 'desc' } });
    return orders.map((o) => ({
      id: o.id,
      status: o.status,
      customerId: o.customerId,
      vendorId: o.vendorId,
    }));
  }
}
