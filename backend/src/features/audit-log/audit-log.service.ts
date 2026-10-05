import { Injectable } from '@nestjs/common';
import { FeatureService } from '../../common/feature';
import { PrismaService } from '../../prisma/prisma.service';
import {
  GetApiAdminAuditLogResponseDto,
  PostApiAdminAuditLogRequestDto,
  PostApiAdminAuditLogResponseDto,
} from './audit-log.dto';

@Injectable()
export class AuditLogService extends FeatureService {
  constructor(prisma: PrismaService) {
    super(prisma, ['AuditEntry']);
  }

  /** All AuditEntry rows, oldest first (chronological order). */
  async list(): Promise<GetApiAdminAuditLogResponseDto[]> {
    const rows = await this.model('AuditEntry').findMany({ orderBy: { createdAt: 'asc' } });
    return rows.map((r) => ({
      id: r.id,
      action: r.action,
      userId: r.userId,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  /** Store a new AuditEntry and return the created record. */
  async create(dto: PostApiAdminAuditLogRequestDto): Promise<PostApiAdminAuditLogResponseDto & { userId: string }> {
    const r = await this.model('AuditEntry').create({
      data: { action: dto.action, userId: dto.userId },
    });
    return { id: r.id, action: r.action, userId: r.userId, createdAt: r.createdAt.toISOString() };
  }
}
