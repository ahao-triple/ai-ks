import { BadRequestException } from '@nestjs/common';
import {
  DEFAULT_PLATFORM_CONFIG,
  PlatformConfigService,
  type PlatformConfigPrisma,
} from './platform-config.service';

describe('PlatformConfigService', () => {
  it('returns the default business config when no row exists yet', async () => {
    const prisma = createFakePrisma();
    const service = new PlatformConfigService(prisma);

    await expect(service.getConfig()).resolves.toEqual(DEFAULT_PLATFORM_CONFIG);
  });

  it('rejects settlement ratios whose total is not 100 percent', async () => {
    const prisma = createFakePrisma();
    const service = new PlatformConfigService(prisma);

    await expect(
      service.updateConfig({
        actorId: 'admin',
        actorType: 'SUPER_ADMIN',
        defaultAgentRatioPercent: 0,
        directAgentRatioPercent: 10,
        displayRatioPercent: 50,
        feeRatioPercent: 0,
        minWithdrawalLi: 10000n,
        parentAgentRatioPercent: 10,
        userSettlementRatioPercent: 70,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('upserts valid config and writes an audit log', async () => {
    const prisma = createFakePrisma();
    const service = new PlatformConfigService(prisma);

    const result = await service.updateConfig({
      actorId: 'admin',
      actorType: 'SUPER_ADMIN',
      defaultAgentId: 'agent-default-1',
      defaultAgentRatioPercent: 5,
      directAgentRatioPercent: 10,
      displayRatioPercent: 60,
      feeRatioPercent: 5,
      minWithdrawalLi: 20000n,
      parentAgentRatioPercent: 10,
      userSettlementRatioPercent: 70,
    });

    expect(result).toMatchObject({
      defaultAgentId: 'agent-default-1',
      defaultAgentRatioPercent: 5,
      directAgentRatioPercent: 10,
      displayRatioPercent: 60,
      feeRatioPercent: 5,
      minWithdrawalLi: 20000n,
      parentAgentRatioPercent: 10,
      userSettlementRatioPercent: 70,
    });
    expect(prisma.getAuditActions()).toEqual(['platform_config.updated']);
  });

  it('rejects a default agent id that does not point to an active agent', async () => {
    const prisma = createFakePrisma({ includeDefaultAgent: false });
    const service = new PlatformConfigService(prisma);

    await expect(
      service.updateConfig({
        actorId: 'admin',
        actorType: 'SUPER_ADMIN',
        defaultAgentId: 'missing-agent',
        defaultAgentRatioPercent: 5,
        directAgentRatioPercent: 10,
        displayRatioPercent: 60,
        feeRatioPercent: 5,
        minWithdrawalLi: 20000n,
        parentAgentRatioPercent: 10,
        userSettlementRatioPercent: 70,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

function createFakePrisma(
  options: { includeDefaultAgent?: boolean } = {},
): PlatformConfigPrisma & {
  getAuditActions(): string[];
} {
  let configRow: any = null;
  const auditLogs: any[] = [];
  const agents = new Map<string, any>();
  if (options.includeDefaultAgent !== false) {
    agents.set('agent-default-1', {
      deletedAt: null,
      enabled: true,
      id: 'agent-default-1',
    });
  }

  return {
    agent: {
      findUnique: async ({ where }: any) => {
        const agent = agents.get(where.id);
        if (!agent || agent.deletedAt !== null || agent.enabled !== true) {
          return null;
        }

        return agent;
      },
    } as any,
    auditLog: {
      create: async ({ data }: any) => {
        auditLogs.push(data);
        return data;
      },
    } as any,
    getAuditActions: () => auditLogs.map((row) => row.action),
    platformConfig: {
      findUnique: async ({ where }: any) =>
        where.key === 'default' ? configRow : null,
      upsert: async ({ create, update }: any) => {
        configRow = {
          createdAt: new Date('2026-05-09T00:00:00.000Z'),
          key: 'default',
          updatedAt: new Date('2026-05-09T00:00:00.000Z'),
          ...(configRow ?? {}),
          ...create,
          ...update,
        };
        return configRow;
      },
    } as any,
  } as PlatformConfigPrisma & {
    getAuditActions(): string[];
  };
}
