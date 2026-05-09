import { Inject, Injectable, Logger } from '@nestjs/common';
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
  private readonly logger = new Logger(BusinessClosureService.name);

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

    this.logReport(checks, summary);

    return {
      checks,
      metrics,
      summary,
    };
  }

  private logReport(
    checks: BusinessClosureCheck[],
    summary: BusinessClosureReport['summary'],
  ) {
    this.logger.log(
      `真实数据闭环核对汇总：就绪 ${summary.ready} 项，需关注 ${summary.attention} 项，阻塞 ${summary.blocked} 项。`,
    );

    for (const check of checks) {
      this.logger.log(
        `真实数据闭环核对检查项：${check.label}；状态：${presentStatus(check.status)}；证据：${check.evidence.join('，')}。`,
      );
    }
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
      // 真实测试入口：先确认基础资源齐全，否则后续 open_id、ECPM、结算都没有落点。
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
      // 代理用于验证用户归属、默认代理和代理分账，不存在代理时真实闭环会中断。
      description: '代理账号用于承接用户归属、默认代理和代理分账。',
      evidence: [`启用代理 ${metrics.activeAgentCount} 个`],
      key: 'agents',
      label: '代理账号',
      status: metrics.activeAgentCount > 0 ? 'READY' : 'BLOCKED',
    },
    {
      // 用户必须绑定代理，后续结算才能验证直属代理和上级代理分账。
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
      // 游戏登录产生的 open_id 需要绑定到用户，否则收益无法入到具体用户账号。
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
      // ECPM 明细证明快手收益已经同步进系统，是结算预览和确认的来源数据。
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
      // 结算批次证明预算扣减、用户入账和代理分账至少跑通过一次。
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
      // 提现不阻塞开始真实数据测试，但完整闭环验收需要至少验证一次。
      description: '提现不是开始真实数据测试的硬前置，但应在闭环验收时至少跑通过一次。',
      evidence: [`提现批次 ${metrics.withdrawalBatchCount} 个`],
      key: 'withdrawal',
      label: '提现审核',
      status: metrics.withdrawalBatchCount > 0 ? 'READY' : 'ATTENTION',
    },
  ];
}

function presentStatus(status: BusinessClosureCheckStatus) {
  if (status === 'READY') {
    return '已就绪';
  }

  if (status === 'BLOCKED') {
    return '阻塞';
  }

  return '需关注';
}
