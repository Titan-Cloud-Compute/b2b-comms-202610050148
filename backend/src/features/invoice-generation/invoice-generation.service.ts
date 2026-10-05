import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { FeatureService } from '../../common/feature';
import { PrismaService } from '../../prisma/prisma.service';
import { MinioService } from '../../lib/integrations/minio.service';
import type {
  GetApiInvoicesIdDownloadResponseDto,
  PostApiInvoicesRequestDto,
  PostApiInvoicesResponseDto,
} from './invoice-generation.dto';

export const invoiceObjectKey = (id: string): string => `invoices/${id}.txt`;

@Injectable()
export class InvoiceGenerationService extends FeatureService {
  private readonly logger = new Logger(InvoiceGenerationService.name);

  constructor(
    prisma: PrismaService,
    private readonly minio: MinioService,
  ) {
    super(prisma, ['Invoice', 'Order'] as const);
  }

  async create(body: PostApiInvoicesRequestDto | undefined): Promise<PostApiInvoicesResponseDto> {
    const orderId = typeof body?.orderId === 'string' ? body.orderId.trim() : '';
    const amount = Number(body?.amount);
    if (!orderId) throw new BadRequestException('orderId is required');
    if (body?.amount === undefined || body?.amount === null || !Number.isFinite(amount) || amount < 0) {
      throw new BadRequestException('amount must be a non-negative decimal');
    }

    const order = await this.model('Order').findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException(`order ${orderId} not found`);
    if (String(order.status).toLowerCase() !== 'confirmed') {
      throw new BadRequestException('invoices can only be generated for confirmed orders');
    }
    const existing = await this.model('Invoice').findUnique({ where: { orderId } });
    if (existing) throw new ConflictException(`order ${orderId} already has an invoice`);

    const invoice = await this.model('Invoice').create({ data: { orderId, amount } });

    const content = Buffer.from(
      `Invoice ${invoice.id}\nOrder: ${invoice.orderId}\nAmount: ${invoice.amount.toFixed(2)}\nIssued: ${invoice.createdAt.toISOString()}\n`,
      'utf8',
    );
    try {
      await this.minio.putObject(invoiceObjectKey(invoice.id), content, content.length, 'text/plain');
    } catch (err) {
      this.logger.warn(`storing invoice ${invoice.id} failed: ${(err as Error).message}`);
      await this.model('Invoice').delete({ where: { id: invoice.id } }).catch(() => undefined);
      throw err;
    }

    return { id: invoice.id, orderId: invoice.orderId, amount: invoice.amount };
  }

  async download(id: string): Promise<GetApiInvoicesIdDownloadResponseDto> {
    const invoice = await this.model('Invoice').findUnique({ where: { id } });
    if (!invoice) throw new NotFoundException(`invoice ${id} not found`);
    const downloadUrl = await this.minio.getSignedUrl(invoiceObjectKey(invoice.id));
    return { id: invoice.id, downloadUrl };
  }
}
