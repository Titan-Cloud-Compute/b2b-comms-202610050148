import { Body, Controller, Get, HttpCode, Param, Patch, Post, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import type { Request } from 'express';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../../auth/roles.guard';
import { OrderActor, OrderManagementService } from './order-management.service';

function actorOf(req: Request): OrderActor {
  const s = req.session;
  if (!s) throw new UnauthorizedException('not authenticated');
  return { userId: s.userId, role: s.role };
}

@ApiTags('order-management')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/orders')
export class OrderManagementController {
  constructor(private readonly ordermanagement: OrderManagementService) {}

  @Post()
  @HttpCode(201)
  @Roles(UserRole.CUSTOMER)
  async postApiOrders(@Req() req: Request, @Body() body: unknown) {
    return this.ordermanagement.createOrder(actorOf(req), body);
  }

  @Patch(':id/confirm')
  @Roles(UserRole.VENDOR, UserRole.ADMIN)
  async patchApiOrdersIdConfirm(@Req() req: Request, @Param('id') id: string, @Body() body: unknown) {
    return this.ordermanagement.confirmOrder(actorOf(req), id, body);
  }

  @Get()
  @Roles(UserRole.CUSTOMER, UserRole.VENDOR, UserRole.ADMIN)
  async getApiOrders(@Req() req: Request) {
    return this.ordermanagement.listOrders(actorOf(req));
  }
}
