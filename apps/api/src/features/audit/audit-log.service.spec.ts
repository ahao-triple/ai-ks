import { AuditLogService } from './audit-log.service';

describe('AuditLogService', () => {
  it('records and lists audit log entries newest first', async () => {
    const prisma = createFakePrisma();
    const service = new AuditLogService(prisma);

    await service.record({
      action: 'withdrawal.approved',
      actorId: 'admin',
      actorType: 'SUPER_ADMIN',
      metadata: {
        amountLi: '3000',
      },
      targetId: 'batch-1',
      targetType: 'withdrawal_batch',
    });

    const result = await service.list({
      limit: 20,
    });

    expect(result).toEqual([
      expect.objectContaining({
        action: 'withdrawal.approved',
        actorId: 'admin',
        actorType: 'SUPER_ADMIN',
        metadata: {
          amountLi: '3000',
        },
        targetId: 'batch-1',
        targetType: 'withdrawal_batch',
      }),
    ]);
  });
});

function createFakePrisma() {
  const rows: unknown[] = [];

  return {
    auditLog: {
      create: async ({ data }: any) => {
        const row = {
          id: `audit-${rows.length + 1}`,
          createdAt: new Date(`2026-05-07T00:0${rows.length}:00.000Z`),
          ...data,
        };
        rows.push(row);
        return row;
      },
      findMany: async ({ orderBy, take }: any) =>
        rows
          .slice()
          .sort((a: any, b: any) =>
            orderBy?.createdAt === 'desc'
              ? b.createdAt.getTime() - a.createdAt.getTime()
              : a.createdAt.getTime() - b.createdAt.getTime(),
          )
          .slice(0, take),
    },
  } as any;
}
