import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { PrincipalType } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

const CONFIG_KEY = 'default';

export type PlatformBusinessConfig = {
  defaultAgentId: string | null;
  defaultAgentRatioPercent: number;
  directAgentRatioPercent: number;
  displayRatioPercent: number;
  feeRatioPercent: number;
  minWithdrawalLi: bigint;
  parentAgentRatioPercent: number;
  userSettlementRatioPercent: number;
};

export type UpdatePlatformConfigInput = Omit<
  PlatformBusinessConfig,
  'defaultAgentId'
> & {
  actorId: string;
  actorType: PrincipalType;
  defaultAgentId?: string | null;
};

export type PlatformConfigPrisma = Pick<
  PrismaService,
  'agent' | 'auditLog' | 'platformConfig'
>;

export const DEFAULT_PLATFORM_CONFIG: PlatformBusinessConfig = {
  defaultAgentId: null,
  defaultAgentRatioPercent: 0,
  directAgentRatioPercent: 0,
  displayRatioPercent: 50,
  feeRatioPercent: 0,
  minWithdrawalLi: 10000n,
  parentAgentRatioPercent: 0,
  userSettlementRatioPercent: 100,
};

@Injectable()
export class PlatformConfigService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PlatformConfigPrisma,
  ) {}

  async getConfig(): Promise<PlatformBusinessConfig> {
    const row = await this.prisma.platformConfig.findUnique({
      where: {
        key: CONFIG_KEY,
      },
    });

    return row ? presentConfig(row) : DEFAULT_PLATFORM_CONFIG;
  }

  async updateConfig(
    input: UpdatePlatformConfigInput,
  ): Promise<PlatformBusinessConfig> {
    const normalizedConfig = normalizeUpdateInput(input);
    validateConfig(normalizedConfig);
    await this.assertDefaultAgentReady(normalizedConfig);
    const data = {
      defaultAgentId: normalizedConfig.defaultAgentId,
      defaultAgentRatioPercent: normalizedConfig.defaultAgentRatioPercent,
      directAgentRatioPercent: normalizedConfig.directAgentRatioPercent,
      displayRatioPercent: normalizedConfig.displayRatioPercent,
      feeRatioPercent: normalizedConfig.feeRatioPercent,
      minWithdrawalLi: normalizedConfig.minWithdrawalLi,
      parentAgentRatioPercent: normalizedConfig.parentAgentRatioPercent,
      userSettlementRatioPercent: normalizedConfig.userSettlementRatioPercent,
    };
    const row = await this.prisma.platformConfig.upsert({
      create: {
        key: CONFIG_KEY,
        ...data,
      },
      update: data,
      where: {
        key: CONFIG_KEY,
      },
    });
    const config = presentConfig(row);

    await this.prisma.auditLog.create({
      data: {
        action: 'platform_config.updated',
        actorId: input.actorId,
        actorType: input.actorType,
        metadata: snapshotPlatformConfig(config),
        targetId: CONFIG_KEY,
        targetType: 'platform_config',
      },
    });

    return config;
  }

  private async assertDefaultAgentReady(config: PlatformBusinessConfig) {
    if (!config.defaultAgentId) {
      if (config.defaultAgentRatioPercent > 0) {
        throw new BadRequestException(
          '默认代理比例大于 0 时必须填写默认代理 ID',
        );
      }
      return;
    }

    const agent = await this.prisma.agent.findUnique({
      where: {
        id: config.defaultAgentId,
      },
    });
    if (!agent || agent.deletedAt !== null || agent.enabled !== true) {
      throw new BadRequestException('默认代理必须是启用状态');
    }
  }
}

export function snapshotPlatformConfig(
  config: PlatformBusinessConfig,
): Record<string, number | string | null> {
  return {
    defaultAgentId: config.defaultAgentId,
    defaultAgentRatioPercent: config.defaultAgentRatioPercent,
    directAgentRatioPercent: config.directAgentRatioPercent,
    displayRatioPercent: config.displayRatioPercent,
    feeRatioPercent: config.feeRatioPercent,
    minWithdrawalLi: config.minWithdrawalLi.toString(),
    parentAgentRatioPercent: config.parentAgentRatioPercent,
    userSettlementRatioPercent: config.userSettlementRatioPercent,
  };
}

function presentConfig(row: PlatformBusinessConfig): PlatformBusinessConfig {
  return {
    defaultAgentId: row.defaultAgentId ?? null,
    defaultAgentRatioPercent: row.defaultAgentRatioPercent,
    directAgentRatioPercent: row.directAgentRatioPercent,
    displayRatioPercent: row.displayRatioPercent,
    feeRatioPercent: row.feeRatioPercent,
    minWithdrawalLi: row.minWithdrawalLi,
    parentAgentRatioPercent: row.parentAgentRatioPercent,
    userSettlementRatioPercent: row.userSettlementRatioPercent,
  };
}

function normalizeUpdateInput(
  input: UpdatePlatformConfigInput,
): PlatformBusinessConfig {
  const defaultAgentId =
    typeof input.defaultAgentId === 'string'
      ? input.defaultAgentId.trim() || null
      : null;

  return {
    defaultAgentId,
    defaultAgentRatioPercent: input.defaultAgentRatioPercent,
    directAgentRatioPercent: input.directAgentRatioPercent,
    displayRatioPercent: input.displayRatioPercent,
    feeRatioPercent: input.feeRatioPercent,
    minWithdrawalLi: input.minWithdrawalLi,
    parentAgentRatioPercent: input.parentAgentRatioPercent,
    userSettlementRatioPercent: input.userSettlementRatioPercent,
  };
}

function validateConfig(config: PlatformBusinessConfig) {
  const percentFields = [
    'displayRatioPercent',
    'userSettlementRatioPercent',
    'directAgentRatioPercent',
    'parentAgentRatioPercent',
    'defaultAgentRatioPercent',
    'feeRatioPercent',
  ] as const;
  for (const field of percentFields) {
    const value = config[field];
    if (!Number.isInteger(value) || value < 0 || value > 100) {
      throw new BadRequestException(`${field} must be an integer from 0 to 100`);
    }
  }

  const settlementTotal =
    config.userSettlementRatioPercent +
    config.directAgentRatioPercent +
    config.parentAgentRatioPercent +
    config.defaultAgentRatioPercent +
    config.feeRatioPercent;
  if (settlementTotal !== 100) {
    throw new BadRequestException('Settlement split ratios must sum to 100');
  }

  if (config.minWithdrawalLi < 0n) {
    throw new BadRequestException('Minimum withdrawal amount cannot be negative');
  }
}
