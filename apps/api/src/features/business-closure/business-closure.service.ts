import { Inject, Injectable } from '@nestjs/common';
import { SettlementStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

export type BusinessClosureCheckStatus = 'ATTENTION' | 'BLOCKED' | 'READY';

export type BusinessClosureCheck = {
  description: string;
  evidence: string[];
  key:
    | 'agents'
    | 'ecpm'
    | 'open_ids'
    | 'resources'
    | 'settlement'
    | 'user_agent_binding'
    | 'withdrawal';
  label: string;
  status: BusinessClosureCheckStatus;
};

export type BusinessClosureMetrics = {
  activeAgentCount: number;
  boundOpenIdCount: number;
  boundUserCount: number;
  companyCount: number;
  gameBudgetLi: bigint;
  gameCount: number;
  openIdCount: number;
  pendingEcpmCount: number;
  rawEcpmCount: number;
  settlementBatchCount: number;
  userCount: number;
  withdrawalBatchCount: number;
};

export type BusinessClosureReport = {
  checks: BusinessClosureCheck[];
  metrics: BusinessClosureMetrics;
  summary: {
    attention: number;
    blocked: number;
    ready: number;
  };
};

type BusinessClosurePrisma = Pick<
  PrismaService,
  | 'agent'
  | 'company'
  | 'game'
  | 'gameOpenId'
  | 'rawEcpm'
  | 'settlementBatch'
  | 'userAccount'
  | 'withdrawalBatch'
>;

@Injectable()
export class BusinessClosureService {
  constructor(
    @Inject(PrismaService) private readonly prisma: BusinessClosurePrisma,
  ) {}

  async getReport(): Promise<BusinessClosureReport> {
    const metrics = await this.collectMetrics();
    const checks = buildChecks(metrics);
    const summary = checks.reduce(
      (total, check) => ({
        ...total,
        [check.status.toLowerCase()]:
          total[check.status.toLowerCase() as keyof typeof total] + 1,
      }),
      { attention: 0, blocked: 0, ready: 0 },
    );

    return {
      checks,
      metrics,
      summary,
    };
  }

  private async collectMetrics(): Promise<BusinessClosureMetrics> {
    const [
      companyCount,
      gameCount,
      gameBudget,
      activeAgentCount,
      userCount,
      boundUserCount,
      openIdCount,
      boundOpenIdCount,
      rawEcpmCount,
      pendingEcpmCount,
      settlementBatchCount,
      withdrawalBatchCount,
    ] = await Promise.all([
      this.prisma.company.count({
        where: {
          deletedAt: null,
        },
      }),
      this.prisma.game.count({
        where: {
          deletedAt: null,
        },
      }),
      this.prisma.game.aggregate({
        _sum: {
          budgetLi: true,
        },
        where: {
          deletedAt: null,
        },
      }),
      this.prisma.agent.count({
        where: {
          deletedAt: null,
          enabled: true,
        },
      }),
      this.prisma.userAccount.count({
        where: {
          deletedAt: null,
        },
      }),
      this.prisma.userAccount.count({
        where: {
          currentAgentId: {
            not: null,
          },
          deletedAt: null,
        },
      }),
      this.prisma.gameOpenId.count(),
      this.prisma.gameOpenId.count({
        where: {
          userId: {
            not: null,
          },
        },
      }),
      this.prisma.rawEcpm.count(),
      this.prisma.rawEcpm.count({
        where: {
          status: SettlementStatus.PENDING,
        },
      }),
      this.prisma.settlementBatch.count(),
      this.prisma.withdrawalBatch.count(),
    ]);

    return {
      activeAgentCount,
      boundOpenIdCount,
      boundUserCount,
      companyCount,
      gameBudgetLi: gameBudget._sum.budgetLi ?? 0n,
      gameCount,
      openIdCount,
      pendingEcpmCount,
      rawEcpmCount,
      settlementBatchCount,
      userCount,
      withdrawalBatchCount,
    };
  }
}

function buildChecks(metrics: BusinessClosureMetrics): BusinessClosureCheck[] {
  const unboundUserCount = Math.max(
    metrics.userCount - metrics.boundUserCount,
    0,
  );
  const unboundOpenIdCount = Math.max(
    metrics.openIdCount - metrics.boundOpenIdCount,
    0,
  );

  return [
    {
      description: '真实数据测试前必须至少有公司、游戏和可用预算。',
      evidence: [
        `公司 ${metrics.companyCount} 个`,
        `游戏 ${metrics.gameCount} 个`,
        `游戏预算合计 ${metrics.gameBudgetLi.toString()} 厘`,
      ],
      key: 'resources',
      label: '公司 / 游戏 / 预算',
      status:
        metrics.companyCount > 0 &&
        metrics.gameCount > 0 &&
        metrics.gameBudgetLi > 0n
          ? 'READY'
          : metrics.companyCount > 0 && metrics.gameCount > 0
            ? 'ATTENTION'
            : 'BLOCKED',
    },
    {
      description: '代理账号用于承接用户归属、默认代理和代理分账。',
      evidence: [`启用代理 ${metrics.activeAgentCount} 个`],
      key: 'agents',
      label: '代理账号',
      status: metrics.activeAgentCount > 0 ? 'READY' : 'BLOCKED',
    },
    {
      description: '用户归属决定真实结算时直属代理和上级代理分账。',
      evidence: [
        `用户 ${metrics.userCount} 个`,
        `已绑定代理用户 ${metrics.boundUserCount} 个`,
        `未绑定代理用户 ${unboundUserCount} 个`,
      ],
      key: 'user_agent_binding',
      label: '用户代理归属',
      status:
        metrics.userCount > 0 && unboundUserCount === 0
          ? 'READY'
          : metrics.boundUserCount > 0
            ? 'ATTENTION'
            : 'BLOCKED',
    },
    {
      description: 'open_id 必须绑定到用户，结算才会把收益入账到正确账号。',
      evidence: [
        `open_id ${metrics.openIdCount} 个`,
        `已绑定用户 open_id ${metrics.boundOpenIdCount} 个`,
        `未绑定 open_id ${unboundOpenIdCount} 个`,
      ],
      key: 'open_ids',
      label: 'open_id 绑定',
      status:
        metrics.boundOpenIdCount > 0
          ? 'READY'
          : metrics.openIdCount > 0
            ? 'ATTENTION'
            : 'BLOCKED',
    },
    {
      description: 'ECPM 明细是结算来源，可用待结算明细或已结算批次证明链路可跑。',
      evidence: [
        `ECPM 明细 ${metrics.rawEcpmCount} 条`,
        `待结算 ${metrics.pendingEcpmCount} 条`,
      ],
      key: 'ecpm',
      label: 'ECPM 收益明细',
      status:
        metrics.pendingEcpmCount > 0 || metrics.settlementBatchCount > 0
          ? 'READY'
          : metrics.rawEcpmCount > 0
            ? 'ATTENTION'
            : 'BLOCKED',
    },
    {
      description: '结算确认会扣游戏预算，并把用户和代理收益入账。',
      evidence: [
        `结算批次 ${metrics.settlementBatchCount} 个`,
        `待结算 ECPM ${metrics.pendingEcpmCount} 条`,
      ],
      key: 'settlement',
      label: '结算入账',
      status:
        metrics.settlementBatchCount > 0
          ? 'READY'
          : metrics.pendingEcpmCount > 0
            ? 'ATTENTION'
            : 'BLOCKED',
    },
    {
      description: '提现不是开始真实数据测试的硬前置，但应在闭环验收时至少跑通过一次。',
      evidence: [`提现批次 ${metrics.withdrawalBatchCount} 个`],
      key: 'withdrawal',
      label: '提现审核',
      status: metrics.withdrawalBatchCount > 0 ? 'READY' : 'ATTENTION',
    },
  ];
}
