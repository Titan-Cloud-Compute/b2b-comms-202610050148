import { BadRequestException, Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../../auth/roles.guard';
import { CustomerInviteService } from './customer-invite.service';
import { PostApiAdminCustomersInviteRequestDto } from './customer-invite.dto';

@ApiTags('customer-invite')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('api/admin/customers')
export class CustomerInviteController {
  constructor(private readonly customerinvite: CustomerInviteService) {}

  @Post('invite')
  @HttpCode(HttpStatus.CREATED)
  async postApiAdminCustomersInvite(@Body() body: PostApiAdminCustomersInviteRequestDto) {
    const email = typeof body?.email === 'string' ? body.email.trim() : '';
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new BadRequestException('A valid email is required');
    }
    return this.customerinvite.invite(email);
  }

  @Get()
  async getApiAdminCustomers() {
    return this.customerinvite.list();
  }
}
