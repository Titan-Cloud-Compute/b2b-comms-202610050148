import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { FeatureService } from '../../common/feature';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  GetApiChannelsResponseDto,
  PostApiChannelsIdMessagesResponseDto,
  PostApiChannelsResponseDto,
} from './shared-channel.dto';

@Injectable()
export class SharedChannelService extends FeatureService {
  constructor(prisma: PrismaService) {
    super(prisma, ['Channel', 'Message', 'VendorProfile'] as const);
  }

  async createChannel(userId: string, name: unknown): Promise<PostApiChannelsResponseDto> {
    const trimmed = typeof name === 'string' ? name.trim() : '';
    if (!trimmed) throw new BadRequestException('name is required');
    const profile = await this.model('VendorProfile').findUnique({ where: { userId } });
    if (!profile) throw new ForbiddenException('only vendors with a profile can create channels');
    const channel = await this.model('Channel').create({
      data: { name: trimmed, vendorId: profile.id, vendorProfileId: profile.id },
    });
    return { id: channel.id, name: channel.name };
  }

  async listChannels(): Promise<GetApiChannelsResponseDto[]> {
    const channels = await this.model('Channel').findMany({ orderBy: { createdAt: 'asc' } });
    return channels.map((c) => ({ id: c.id, name: c.name }));
  }

  async postMessage(
    userId: string,
    channelId: string,
    body: unknown,
  ): Promise<PostApiChannelsIdMessagesResponseDto> {
    const text = typeof body === 'string' ? body.trim() : '';
    if (!text) throw new BadRequestException('body is required');
    const channel = await this.model('Channel').findUnique({ where: { id: channelId } });
    if (!channel) throw new NotFoundException('channel not found');
    const message = await this.model('Message').create({
      data: { body: text, channelId: channel.id, senderId: userId },
    });
    return { id: message.id, body: message.body, channelId: message.channelId };
  }
}
