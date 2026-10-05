import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../../auth/roles.guard';
import { PostApiAdminAuditLogRequestDto } from './audit-log.dto';
import { AuditLogService } from './audit-log.service';

@ApiTags('audit-log')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('api/admin/audit-log')
export class AuditLogController {
  constructor(private readonly auditlog: AuditLogService) {}

  /** GET /api/admin/audit-log — AuditEntry records, oldest first. */
  @Get()
  async getApiAdminAuditLog() {
    return this.auditlog.list();
  }

  /** POST /api/admin/audit-log — store an AuditEntry; 201 with the created record. */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async postApiAdminAuditLog(@Body() body: PostApiAdminAuditLogRequestDto) {
    return this.auditlog.create(body);
  }
}
