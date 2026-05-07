import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

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
  limit?: number;
};

@Injectable()
export class AuditLogService {
  constructor(@Inject(PrismaService) private readonly prisma: AuditPrisma) {}

  record(input: RecordAuditLogInput) {
    return this.prisma.auditLog.create({
      data: input,
    });
  }

  list(input: ListAuditLogsInput = {}) {
    return this.prisma.auditLog.findMany({
      orderBy: {
        createdAt: 'desc',
      },
      take: Math.min(Math.max(input.limit ?? 50, 1), 100),
    });
  }
}
