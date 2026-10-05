import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { FeatureService } from '../../common/feature';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  GetApiVendorDocumentsResponseDto,
  PostApiVendorDocumentsRequestDto,
  PostApiVendorDocumentsResponseDto,
  PostApiVendorProfileRequestDto,
  PostApiVendorProfileResponseDto,
} from './vendor-onboarding.dto';

@Injectable()
export class VendorOnboardingService extends FeatureService {
  constructor(prisma: PrismaService) {
    super(prisma, ['VendorProfile', 'Document'] as const);
  }

  async upsertProfile(userId: string, body: PostApiVendorProfileRequestDto): Promise<PostApiVendorProfileResponseDto> {
    const companyName = typeof body?.companyName === 'string' ? body.companyName.trim() : '';
    const contactEmail = typeof body?.contactEmail === 'string' ? body.contactEmail.trim() : '';
    if (!companyName) throw new BadRequestException('companyName is required');
    if (!contactEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
      throw new BadRequestException('contactEmail must be a valid email');
    }
    const p = await this.model('VendorProfile').upsert({
      where: { userId },
      create: { userId, companyName, contactEmail },
      update: { companyName, contactEmail },
    });
    return { id: p.id, companyName: p.companyName, contactEmail: p.contactEmail };
  }

  async uploadDocument(userId: string, body: PostApiVendorDocumentsRequestDto): Promise<PostApiVendorDocumentsResponseDto> {
    const filename = typeof body?.filename === 'string' ? body.filename.trim() : '';
    if (!filename) throw new BadRequestException('filename is required');
    const profile = await this.model('VendorProfile').findUnique({ where: { userId } });
    if (!profile) throw new NotFoundException('Submit your vendor profile before uploading documents');
    const d = await this.model('Document').create({
      data: { filename, status: 'pending', vendorProfileId: profile.id },
    });
    return { id: d.id, filename: d.filename, status: d.status };
  }

  async listDocuments(userId: string): Promise<GetApiVendorDocumentsResponseDto[]> {
    const profile = await this.model('VendorProfile').findUnique({ where: { userId } });
    if (!profile) return [];
    const docs = await this.model('Document').findMany({
      where: { vendorProfileId: profile.id },
      orderBy: { createdAt: 'desc' },
    });
    return docs.map((d) => ({ id: d.id, filename: d.filename, status: d.status }));
  }
}
