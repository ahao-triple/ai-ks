import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AdminAccessControlService } from '../admin-auth/admin-access-control.service';
import { type AdminPrincipal } from '../admin-auth/admin-auth.service';

type AuditPrisma = Pick<PrismaService, 'auditLog'>;

export type RecordAuditLogInput = {
  action: string;
  actorId: string;
  actorType: string;
  metadata: Prisma.InputJsonObject;
  targetId: string;
  targetType: string;
};

export type ListAuditLogsInput = {
  admin: AdminPrincipal;
  limit?: number;
};

@Injectable()
export class AuditLogService {
  constructor(
    @Inject(PrismaService) private readonly prisma: AuditPrisma,
    private readonly accessControlService: AdminAccessControlService,
  ) {}

  record(input: RecordAuditLogInput) {
    return this.prisma.auditLog.create({
      data: input,
    });
  }

  async list(input: ListAuditLogsInput) {
    const scope = await this.accessControlService.resolveReadScope(input.admin);
    if (!scope.isSuperAdmin) {
      const companyIds = scope.companyIds ?? [];
      const gameIds = scope.gameIds ?? [];
      if (companyIds.length === 0 && gameIds.length === 0) {
        return [];
      }

      return this.prisma.auditLog.findMany({
        orderBy: {
          createdAt: 'desc',
        },
        take: Math.min(Math.max(input.limit ?? 50, 1), 100),
        where: {
          OR: [
            {
              targetId: {
                in: companyIds,
              },
              targetType: 'company',
            },
            {
              targetId: {
                in: gameIds,
              },
              targetType: 'game',
            },
          ],
        },
      });
    }

    return this.prisma.auditLog.findMany({
      orderBy: {
        createdAt: 'desc',
      },
      take: Math.min(Math.max(input.limit ?? 50, 1), 100),
    });
  }
}
