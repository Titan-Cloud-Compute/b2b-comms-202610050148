import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SharedChannelService } from './shared-channel.service';

function makePrisma() {
  return {
    vendorProfile: { findUnique: jest.fn() },
    channel: { create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn() },
    message: { create: jest.fn() },
  };
}

describe('SharedChannelService', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let service: SharedChannelService;

  beforeEach(() => {
    prisma = makePrisma();
    service = new SharedChannelService(prisma as unknown as PrismaService);
  });

  it('creates a channel owned by the vendor profile', async () => {
    prisma.vendorProfile.findUnique.mockResolvedValue({ id: 'vp1', userId: 'u1' });
    prisma.channel.create.mockResolvedValue({ id: 'c1', name: 'Ops', vendorId: 'vp1' });
    await expect(service.createChannel('u1', ' Ops ')).resolves.toEqual({ id: 'c1', name: 'Ops' });
    expect(prisma.channel.create).toHaveBeenCalledWith({
      data: { name: 'Ops', vendorId: 'vp1', vendorProfileId: 'vp1' },
    });
  });

  it('rejects channel creation without a vendor profile or name', async () => {
    prisma.vendorProfile.findUnique.mockResolvedValue(null);
    await expect(service.createChannel('u1', 'Ops')).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.createChannel('u1', '')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('lists channels as id/name', async () => {
    prisma.channel.findMany.mockResolvedValue([{ id: 'c1', name: 'Ops', vendorId: 'vp1' }]);
    await expect(service.listChannels()).resolves.toEqual([{ id: 'c1', name: 'Ops' }]);
  });

  it('stores a message with the session user as sender', async () => {
    prisma.channel.findUnique.mockResolvedValue({ id: 'c1' });
    prisma.message.create.mockResolvedValue({ id: 'm1', body: 'hi', channelId: 'c1', senderId: 'u2' });
    await expect(service.postMessage('u2', 'c1', 'hi')).resolves.toEqual({ id: 'm1', body: 'hi', channelId: 'c1' });
    expect(prisma.message.create).toHaveBeenCalledWith({ data: { body: 'hi', channelId: 'c1', senderId: 'u2' } });
  });

  it('404s when posting to a missing channel', async () => {
    prisma.channel.findUnique.mockResolvedValue(null);
    await expect(service.postMessage('u2', 'nope', 'hi')).rejects.toBeInstanceOf(NotFoundException);
  });
});
