import { Injectable } from '@nestjs/common';
import { FeatureService } from '../../common/feature';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  GetApiNotificationsPreferencesResponseDto,
  PutApiNotificationsPreferencesRequestDto,
  PutApiNotificationsPreferencesResponseDto,
} from './notification-preferences.dto';

@Injectable()
export class NotificationPreferencesService extends FeatureService {
  constructor(prisma: PrismaService) {
    super(prisma, ['NotificationPreference']);
  }

  async get(userId: string): Promise<GetApiNotificationsPreferencesResponseDto> {
    const row = await this.prisma.notificationPreference.findUnique({ where: { userId } });
    return {
      userId,
      orderAlerts: row?.orderAlerts ?? false,
      messageAlerts: row?.messageAlerts ?? false,
    };
  }

  async upsert(
    userId: string,
    input: PutApiNotificationsPreferencesRequestDto,
  ): Promise<PutApiNotificationsPreferencesResponseDto> {
    const data = { orderAlerts: input.orderAlerts, messageAlerts: input.messageAlerts };
    const row = await this.prisma.notificationPreference.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });
    return { userId: row.userId, orderAlerts: row.orderAlerts, messageAlerts: row.messageAlerts };
  }
}
