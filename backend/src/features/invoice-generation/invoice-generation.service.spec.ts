import { BadRequestException, NotFoundException } from '@nestjs/common';
import { InvoiceGenerationService, invoiceObjectKey } from './invoice-generation.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { MinioService } from '../../lib/integrations/minio.service';

function setup(orderStatus: string | null) {
  const prisma = {
    order: {
      findUnique: jest.fn().mockResolvedValue(orderStatus === null ? null : { id: 'o1', status: orderStatus }),
    },
    invoice: {
      findUnique: jest.fn().mockImplementation(({ where }: any) =>
        Promise.resolve(where.id === 'i1' ? { id: 'i1', orderId: 'o1', amount: 12.5 } : null),
      ),
      create: jest.fn().mockImplementation(({ data }: any) =>
        Promise.resolve({ id: 'i1', ...data, createdAt: new Date() }),
      ),
      delete: jest.fn().mockResolvedValue(undefined),
    },
  };
  const minio = {
    putObject: jest.fn().mockResolvedValue({ etag: 'e', bucket: 'b', key: 'k' }),
    getSignedUrl: jest.fn().mockResolvedValue('https://minio.local/b/invoices/i1.txt?sig'),
  };
  const service = new InvoiceGenerationService(
    prisma as unknown as PrismaService,
    minio as unknown as MinioService,
  );
  return { prisma, minio, service };
}

describe('InvoiceGenerationService', () => {
  it('creates an invoice for a confirmed order and stores it', async () => {
    const { service, minio } = setup('confirmed');
    const res = await service.create({ orderId: 'o1', amount: 12.5 });
    expect(res).toEqual({ id: 'i1', orderId: 'o1', amount: 12.5 });
    expect(minio.putObject).toHaveBeenCalledWith(invoiceObjectKey('i1'), expect.any(Buffer), expect.any(Number), 'text/plain');
  });

  it('rejects orders that are not confirmed', async () => {
    const { service } = setup('pending');
    await expect(service.create({ orderId: 'o1', amount: 1 })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('404s for a missing order', async () => {
    const { service } = setup(null);
    await expect(service.create({ orderId: 'nope', amount: 1 })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns a downloadUrl for a stored invoice', async () => {
    const { service } = setup('confirmed');
    await expect(service.download('i1')).resolves.toEqual({
      id: 'i1',
      downloadUrl: 'https://minio.local/b/invoices/i1.txt?sig',
    });
    await expect(service.download('missing')).rejects.toBeInstanceOf(NotFoundException);
  });
});
