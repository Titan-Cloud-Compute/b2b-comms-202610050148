import { BadRequestException, Body, Controller, UseGuards, Put, Get, Req, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import type { Request } from 'express';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../../auth/roles.guard';
import { NotificationPreferencesService } from './notification-preferences.service';
import type {
  GetApiNotificationsPreferencesResponseDto,
  PutApiNotificationsPreferencesResponseDto,
} from './notification-preferences.dto';

@ApiTags('notification-preferences')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.USER)
@Controller('api/notifications')
export class NotificationPreferencesController {
  constructor(private readonly notificationpreferences: NotificationPreferencesService) {}

  @Put('preferences')
  @HttpCode(HttpStatus.OK)
  async putApiNotificationsPreferences(
    @Req() req: Request,
    @Body() body: unknown,
  ): Promise<PutApiNotificationsPreferencesResponseDto> {
    const b = (body ?? {}) as Record<string, unknown>;
    if (typeof b.orderAlerts !== 'boolean' || typeof b.messageAlerts !== 'boolean') {
      throw new BadRequestException('orderAlerts and messageAlerts must be booleans');
    }
    const { userId } = req.session!;
    return this.notificationpreferences.upsert(userId, {
      orderAlerts: b.orderAlerts,
      messageAlerts: b.messageAlerts,
    });
  }

  @Get('preferences')
  async getApiNotificationsPreferences(@Req() req: Request): Promise<GetApiNotificationsPreferencesResponseDto> {
    const { userId } = req.session!;
    return this.notificationpreferences.get(userId);
  }
}
