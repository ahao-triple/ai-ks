import { AuditLogService } from './audit-log.service';

describe('AuditLogService', () => {
  it('records and lists audit log entries newest first', async () => {
    const prisma = createFakePrisma();
    const accessControlService = createAccessControlService();
    const service = new AuditLogService(prisma, accessControlService);

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
      admin: superAdmin,
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
    expect(prisma.lastFindManyArgs).not.toHaveProperty('where');
  });

  it('limits company admins to directly scoped company and game audit logs', async () => {
    const prisma = createFakePrisma();
    const accessControlService = createAccessControlService({
      companyIds: ['company-1'],
      gameAppIds: ['app-1'],
      gameIds: ['game-1'],
      isSuperAdmin: false,
    });
    const service = new AuditLogService(prisma, accessControlService);

    await seedAuditLogs(service);

    const result = await service.list({
      admin: companyAdmin,
      limit: 20,
    });

    expect(result.map((row) => row.targetType)).toEqual(['game', 'company']);
    expect(result.map((row) => row.targetId)).toEqual(['game-1', 'company-1']);
    expect(prisma.lastFindManyArgs).toMatchObject({
      where: {
        OR: [
          { targetType: 'company', targetId: { in: ['company-1'] } },
          { targetType: 'game', targetId: { in: ['game-1'] } },
        ],
      },
    });
  });

  it('excludes non-direct audit targets for company admins even when metadata names scoped ids', async () => {
    const prisma = createFakePrisma();
    const accessControlService = createAccessControlService({
      companyIds: ['company-1'],
      gameAppIds: ['app-1'],
      gameIds: ['game-1'],
      isSuperAdmin: false,
    });
    const service = new AuditLogService(prisma, accessControlService);

    await service.record({
      action: 'settlement.changed',
      actorId: 'admin',
      actorType: 'SUPER_ADMIN',
      metadata: {
        companyId: 'company-1',
        gameId: 'game-1',
      },
      targetId: 'settlement-1',
      targetType: 'settlement',
    });

    await expect(
      service.list({
        admin: companyAdmin,
        limit: 20,
      }),
    ).resolves.toEqual([]);
  });

  it('returns no audit logs for company admins with empty scope', async () => {
    const prisma = createFakePrisma();
    const accessControlService = createAccessControlService({
      companyIds: [],
      gameAppIds: [],
      gameIds: [],
      isSuperAdmin: false,
    });
    const service = new AuditLogService(prisma, accessControlService);

    await seedAuditLogs(service);

    await expect(
      service.list({
        admin: companyAdmin,
        limit: 20,
      }),
    ).resolves.toEqual([]);

    expect(prisma.findManyCallCount).toBe(0);
  });
});

const superAdmin = { role: 'SUPER_ADMIN' as const, username: 'admin' };

const companyAdmin = {
  adminId: 'company-admin-1',
  displayName: 'Company Admin',
  role: 'COMPANY_ADMIN' as const,
  username: 'company_admin',
};

async function seedAuditLogs(service: AuditLogService) {
  await service.record({
    action: 'company.updated',
    actorId: 'admin',
    actorType: 'SUPER_ADMIN',
    metadata: {},
    targetId: 'company-1',
    targetType: 'company',
  });
  await service.record({
    action: 'game.updated',
    actorId: 'admin',
    actorType: 'SUPER_ADMIN',
    metadata: {},
    targetId: 'game-1',
    targetType: 'game',
  });
  await service.record({
    action: 'game.updated',
    actorId: 'admin',
    actorType: 'SUPER_ADMIN',
    metadata: {},
    targetId: 'game-2',
    targetType: 'game',
  });
  await service.record({
    action: 'route.denied',
    actorId: 'admin',
    actorType: 'SUPER_ADMIN',
    metadata: {
      companyId: 'company-1',
      gameId: 'game-1',
    },
    targetId: 'GET /admin/audit-logs',
    targetType: 'admin_route',
  });
}

function createAccessControlService(
  scope = {
    companyIds: undefined,
    gameAppIds: undefined,
    gameIds: undefined,
    isSuperAdmin: true,
  } as any,
) {
  return {
    resolveReadScope: jest.fn(async () => scope),
  } as any;
}

function createFakePrisma() {
  const rows: unknown[] = [];
  let lastFindManyArgs: any;
  let findManyCallCount = 0;

  return {
    get findManyCallCount() {
      return findManyCallCount;
    },
    get lastFindManyArgs() {
      return lastFindManyArgs;
    },
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
      findMany: async (args: any) => {
        findManyCallCount += 1;
        lastFindManyArgs = args;
        return rows
          .slice()
          .filter((row: any) => matchesWhere(row, args.where))
          .sort((a: any, b: any) =>
            args.orderBy?.createdAt === 'desc'
              ? b.createdAt.getTime() - a.createdAt.getTime()
              : a.createdAt.getTime() - b.createdAt.getTime(),
          )
          .slice(0, args.take);
      },
    },
  } as any;
}

function matchesWhere(row: any, where: any) {
  if (!where) {
    return true;
  }

  return where.OR.some((condition: any) => {
    if (row.targetType !== condition.targetType) {
      return false;
    }
    return condition.targetId.in.includes(row.targetId);
  });
}
