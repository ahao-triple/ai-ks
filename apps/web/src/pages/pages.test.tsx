import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { LoginPage } from './LoginPage';
import { GuestQueryPage } from './GuestQueryPage';
import { AccountWorkspace } from './AccountWorkspace';
import { AgentWorkspace } from './AgentWorkspace';
import {
  OperationsWorkspace,
  type OperationsWorkspaceProps,
} from './OperationsWorkspace';
import {
  buildSettlementRange,
  changeSettlementRange,
  getAdminDisplayName,
  getDefaultAdminCompanyId,
  getDefaultAdminGameId,
  getDefaultKuaishouAppId,
  getAdminEntrySettlementGameRowId,
  getSettlementGameRowId,
  isSuperAdmin,
  mergeEcpmUpdateJob,
  readKuaishouOAuthCallback,
  reconcileSelectedEcpmUpdateJob,
  shouldApplyEcpmUpdateJobsResponse,
  shouldApplySettlementBatchResponse,
} from '../App';
import { buildOperationsOverview } from '../lib/operationsOverview';
import type {
  AdminCompany,
  AdminGame,
  AdminSettlementBatch,
  AdminSettlementDetailResult,
  AdminSettlementPreview,
  AdminWithdrawalBatch,
  AdminWithdrawalDetailResult,
  BusinessClosureReport,
  EcpmUpdateJob,
  KuaishouEcpmSyncJob,
  KuaishouTokenStatusResult,
} from '../types/api';

const confirmableSettlementPreview: AdminSettlementPreview = {
  budgetAfter: { li: '7000', yuan: '70.00' },
  budgetBefore: { li: '10000', yuan: '100.00' },
  canConfirm: true,
  companyId: 'company-1',
  gameId: 'game-1',
  settlementAmount: { li: '3000', yuan: '30.00' },
  settlementCount: 2,
  unboundCount: 0,
  userCount: 2,
};

const serverSettlementBatch: AdminSettlementBatch = {
  budgetAfter: { li: '7000', yuan: '70.00' },
  budgetBefore: { li: '10000', yuan: '100.00' },
  companyId: 'company-1',
  configSnapshot: {},
  createdAt: '2026-05-08T12:00:00.000Z',
  endedAt: '2026-05-08T23:59:59.999Z',
  gameId: 'game-1',
  id: 'settlement-batch-1',
  operatorId: 'admin',
  operatorType: 'SUPER_ADMIN',
  settledAmount: { li: '3000', yuan: '30.00' },
  settledCount: 2,
  startedAt: '2026-05-08T00:00:00.000Z',
  status: 'CONFIRMED',
  userCount: 2,
};

const settlementDetail: AdminSettlementDetailResult = {
  batch: serverSettlementBatch,
  items: [
    {
      createdAt: '2026-05-08T12:00:00.000Z',
      defaultAgentAmount: { li: '50', yuan: '0.05' },
      defaultAgentId: null,
      directAgentAmount: { li: '100', yuan: '0.10' },
      directAgentId: 'agent-direct-1',
      displayAmount: { li: '1000', yuan: '1.00' },
      feeAmount: { li: '50', yuan: '0.05' },
      gameOpenIdId: 'open-row-1',
      id: 'item-1',
      openId: 'open-1',
      parentAgentAmount: { li: '100', yuan: '0.10' },
      parentAgentId: 'agent-parent-1',
      rawEcpmId: 'ecpm-1',
      settlementAmount: { li: '1000', yuan: '1.00' },
      splitSnapshot: {},
      userAmount: { li: '700', yuan: '0.70' },
      userId: 'user-1',
    },
  ],
};

const adminCompany: AdminCompany = {
  balance: { li: '12345', yuan: '12.35' },
  createdAt: '2026-05-08T01:00:00.000Z',
  id: 'company-1',
  name: 'Acme Studio',
  updatedAt: '2026-05-08T01:30:00.000Z',
};

const adminGame: AdminGame = {
  budget: { li: '6000', yuan: '6.00' },
  companyId: 'company-1',
  companyName: 'Acme Studio',
  createdAt: '2026-05-08T02:00:00.000Z',
  ecpmAutoSyncEnabled: false,
  ecpmAutoSyncIntervalHours: 3,
  ecpmAutoSyncLastRunAt: null,
  ecpmAutoSyncNextRunAt: null,
  gameAppId: 'ks_game_001',
  gameSecret: 'secret-1',
  id: 'game-1',
  name: 'Runner',
  settlementPaused: true,
  updatedAt: '2026-05-08T02:30:00.000Z',
};

const companyAdminAccount = {
  createdAt: '2026-05-08T03:00:00.000Z',
  deletedAt: null,
  displayName: 'Acme 只读管理员',
  enabled: true,
  id: 'company-admin-1',
  scopes: [
    {
      companyId: 'company-1',
      gameIds: ['game-1'],
      operationCodes: ['company.read', 'game.read'],
    },
  ],
  updatedAt: '2026-05-08T03:30:00.000Z',
  username: 'acme_admin',
};

const kuaishouTokenStatus: KuaishouTokenStatusResult = {
  accessTokenExpiresAt: '2026-05-09T00:00:00.000Z',
  advertiserId: 'advertiser-1',
  appId: 'app-1',
  authorizedAt: '2026-05-08T00:00:00.000Z',
  configured: true,
  lastError: null,
  refreshTokenExpiresAt: '2026-06-07T00:00:00.000Z',
  refreshedAt: null,
  source: 'database',
  status: 'ACTIVE',
};

const kuaishouEcpmJob: KuaishouEcpmSyncJob = {
  actorId: 'admin',
  actorType: 'SUPER_ADMIN',
  createdAt: '2026-05-08T00:00:00.000Z',
  dataHour: '2026-05-08',
  endedDataHour: '2026-05-08T00:00:00.000Z',
  errorMessage: null,
  finishedAt: '2026-05-08T00:01:00.000Z',
  gameAppId: 'ks_game_001',
  id: 'job-1',
  lookbackHours: 1,
  requestedOpenIdCount: 2,
  savedCount: 1,
  source: 'kuaishou',
  startedAt: '2026-05-08T00:00:00.000Z',
  startedDataHour: '2026-05-08T00:00:00.000Z',
  status: 'SUCCEEDED',
  updatedAt: '2026-05-08T00:01:00.000Z',
};

const ecpmUpdateJob: EcpmUpdateJob = {
  actorId: 'admin',
  actorType: 'SUPER_ADMIN',
  createdAt: '2026-05-08T00:00:00.000Z',
  endedDataHour: '2026-05-08T00:00:00.000Z',
  errorMessage: null,
  failedCount: 0,
  finishedAt: null,
  id: 'ecpm-update-job-1',
  mode: 'latest',
  requestedGameCount: 1,
  requestedOpenIdCount: 2,
  savedCount: 1,
  scopeId: 'game-1',
  scopeType: 'game',
  source: 'kuaishou',
  skippedCount: 0,
  startedAt: '2026-05-08T00:00:00.000Z',
  startedDataHour: '2026-05-08T00:00:00.000Z',
  status: 'RUNNING',
  updatedAt: '2026-05-08T00:00:00.000Z',
};

const withdrawalBatch = {
  createdAt: '2026-05-08T04:00:00.000Z',
  details: [
    {
      amount: { li: '1200', yuan: '12.00' },
      recipientAlipay: 'user@example.com',
      recipientName: 'Demo User',
      status: 'PENDING_REVIEW',
      type: 'USER',
    },
  ],
  id: 'withdrawal-batch-1',
  ownerId: 'user-1',
  ownerType: 'USER',
  status: 'PENDING_REVIEW',
  totalAmount: { li: '1200', yuan: '12.00' },
  updatedAt: '2026-05-08T04:30:00.000Z',
  userId: 'user-1',
} satisfies AdminWithdrawalBatch;

const withdrawalDetail = {
  auditLogs: [],
  batch: withdrawalBatch,
} satisfies AdminWithdrawalDetailResult;

const businessClosureReport: BusinessClosureReport = {
  checks: [
    {
      description: '真实数据测试前必须至少有公司、游戏和可用预算。',
      evidence: ['公司 1 个', '游戏 1 个', '游戏预算合计 10000 厘'],
      key: 'resources',
      label: '公司 / 游戏 / 预算',
      status: 'READY',
    },
    {
      description: '用户归属决定真实结算时直属代理和上级代理分账。',
      evidence: ['用户 1 个', '已绑定代理用户 1 个'],
      key: 'user_agent_binding',
      label: '用户代理归属',
      status: 'READY',
    },
  ],
  metrics: {
    activeAgentCount: 1,
    boundOpenIdCount: 1,
    boundUserCount: 1,
    companyCount: 1,
    gameBudgetLi: '10000',
    gameCount: 1,
    openIdCount: 1,
    pendingEcpmCount: 1,
    rawEcpmCount: 1,
    settlementBatchCount: 0,
    userCount: 1,
    withdrawalBatchCount: 0,
  },
  summary: {
    attention: 0,
    blocked: 0,
    ready: 2,
  },
};

function operationsWorkspaceProps(
  overrides: Partial<OperationsWorkspaceProps> = {},
): OperationsWorkspaceProps {
  const defaults: Omit<OperationsWorkspaceProps, 'operationsOverview'> = {
    adminName: '',
    adminCompanies: [],
    adminGames: [],
    adminWithdrawalStatus: 'PENDING_REVIEW',
    adminWithdrawals: [],
    adminAgents: [],
    agentActionAgentId: '',
    agentAlipayAccount: '',
    agentAlipayRealName: '',
    agentWithdrawalAmountYuan: '',
    auditLogs: [],
    balanceAmountYuan: '',
    balanceCompanyId: '',
    balanceReason: '',
    budgetAmountYuan: '',
    budgetGameId: '',
    budgetReason: '',
    busyAction: '',
    businessClosure: undefined,
    companyAdmins: [],
    configBudgetAmountYuan: '',
    configBudgetReason: '',
    configEcpmLookbackHours: 3,
    configGameDraft: undefined,
    configKuaishouEcpmJobs: [],
    configSection: 'basic',
    gameAppId: 'game-1',
    games: [],
    isSuperAdmin: true,
    jsCode: '',
    kuaishouAppId: '',
    kuaishouAuthCode: '',
    kuaishouEcpmJobs: [],
    kuaishouSecret: '',
    newAgentInvitationCode: '',
    newAgentParentId: '',
    newAgentPassword: '',
    newAgentUsername: '',
    newCompanyName: '',
    newGameAppId: '',
    newGameCompanyId: '',
    newGameName: '',
    newGameSecret: '',
    platformConfig: {
      defaultAgentId: null,
      defaultAgentRatioPercent: 0,
      directAgentRatioPercent: 0,
      displayRatioPercent: 50,
      feeRatioPercent: 0,
      minWithdrawal: { li: '10000', yuan: '10.00' },
      parentAgentRatioPercent: 0,
      userSettlementRatioPercent: 100,
    },
    platformConfigDraft: {
      defaultAgentId: '',
      defaultAgentRatioPercent: '0',
      directAgentRatioPercent: '0',
      displayRatioPercent: '50',
      feeRatioPercent: '0',
      minWithdrawalYuan: '10.00',
      parentAgentRatioPercent: '0',
      userSettlementRatioPercent: '100',
    },
    onLoadPlatformConfig: () => undefined,
    onAdjustCompanyBalance: () => undefined,
    onAllocateGameBudget: () => undefined,
    onApproveWithdrawal: () => undefined,
    onBalanceAmountChange: () => undefined,
    onBalanceCompanyIdChange: () => undefined,
    onBalanceReasonChange: () => undefined,
    onBudgetAmountChange: () => undefined,
    onBudgetGameIdChange: () => undefined,
    onBudgetReasonChange: () => undefined,
    onClearOperationalData: () => undefined,
    onCloseWithdrawal: () => undefined,
    onConfirmSettlement: () => undefined,
    onCloseGameConfig: () => undefined,
    onAgentActionAgentIdChange: () => undefined,
    onAgentAlipayAccountChange: () => undefined,
    onAgentAlipayRealNameChange: () => undefined,
    onAgentWithdrawalAmountChange: () => undefined,
    onCreateAgent: () => undefined,
    onCreateCompany: () => undefined,
    onCreateCompanyAdmin: () => undefined,
    onCreateGame: () => undefined,
    onCreateSession: () => undefined,
    onConfigBudgetAmountChange: () => undefined,
    onConfigBudgetReasonChange: () => undefined,
    onConfigEcpmLookbackHoursChange: () => undefined,
    onConfigGameDraftChange: () => undefined,
    onConfigSectionChange: () => undefined,
    onGameChange: () => undefined,
    onJsCodeChange: () => undefined,
    onKuaishouAppIdChange: () => undefined,
    onKuaishouAuthCodeChange: () => undefined,
    onKuaishouAuthorize: () => undefined,
    onKuaishouRefreshToken: () => undefined,
    onKuaishouSecretChange: () => undefined,
    onLoadKuaishouEcpmJobs: () => undefined,
    onLoadKuaishouTokenStatus: () => undefined,
    onLoadAdminResources: () => undefined,
    onLoadAdminAgents: () => undefined,
    onLoadAuditLogs: () => undefined,
    onLoadBusinessClosure: () => undefined,
    onLoadCompanyAdmins: () => undefined,
    onLoadSettlementDetail: () => undefined,
    onLoadWithdrawalDetail: () => undefined,
    onLoadWithdrawals: () => undefined,
    onNewAgentInvitationCodeChange: () => undefined,
    onNewAgentParentIdChange: () => undefined,
    onNewAgentPasswordChange: () => undefined,
    onNewAgentUsernameChange: () => undefined,
    onNewCompanyNameChange: () => undefined,
    onNewGameAppIdChange: () => undefined,
    onNewGameCompanyIdChange: () => undefined,
    onNewGameNameChange: () => undefined,
    onNewGameSecretChange: () => undefined,
    onPayWithdrawal: () => undefined,
    onPreviewSettlement: () => undefined,
    onPlatformConfigDraftChange: () => undefined,
    onRefreshEcpm: () => undefined,
    onRefreshConfigGameEcpm: () => undefined,
    onRetryKuaishouEcpmJob: () => undefined,
    onRequestAgentWithdrawal: () => undefined,
    onSaveGameConfig: () => undefined,
    onSavePlatformConfig: () => undefined,
    onSettlementEndDateChange: () => undefined,
    onSettlementStartDateChange: () => undefined,
    onSettlementUserIdChange: () => undefined,
    onOpenGameConfig: () => undefined,
    onSubmitConfigBudget: () => undefined,
    onUpdateAgentAlipay: () => undefined,
    onUpdateCompanyAdmin: () => undefined,
    onUpdateCompanyAdminScopes: () => undefined,
    selectedConfigGame: undefined,
    selectedConfigGameId: '',
    selectedSettlementDetail: undefined,
    settlementBatches: [],
    settlementEndDate: '2026-05-08',
    settlementStartDate: '2026-05-08',
    settlementUserId: '',
  };

  const merged = { ...defaults, ...overrides };

  return {
    ...merged,
    operationsOverview:
      overrides.operationsOverview ??
      buildOperationsOverview({
        adminGames: merged.adminGames,
        configKuaishouEcpmJobs: merged.configKuaishouEcpmJobs,
        kuaishouEcpmJobs: merged.kuaishouEcpmJobs,
        settlementBatches: merged.settlementBatches,
        settlementPreview: merged.settlementPreview,
      }),
  };
}

describe('LoginPage', () => {
  it('derives admin display names and super admin flags from principals', () => {
    expect(
      getAdminDisplayName({
        role: 'SUPER_ADMIN',
        username: 'admin',
      }),
    ).toBe('admin');
    expect(
      getAdminDisplayName({
        adminId: 'company-admin-1',
        displayName: '上海运营',
        role: 'COMPANY_ADMIN',
        username: 'company_admin',
      }),
    ).toBe('上海运营');
    expect(isSuperAdmin({ role: 'SUPER_ADMIN', username: 'admin' })).toBe(true);
    expect(
      isSuperAdmin({
        adminId: 'company-admin-1',
        displayName: '上海运营',
        role: 'COMPANY_ADMIN',
        username: 'company_admin',
      }),
    ).toBe(false);
  });

  it('renders a clean login page with guest entry', () => {
    const html = renderToStaticMarkup(
      <LoginPage
        adminPassword="admin123456"
        adminUsername="admin"
        agentPassword="demo-agent-pass"
        agentUsername="demo_default_agent"
        invitationCode=""
        busyAction=""
        mode="account"
        onAdminPasswordChange={() => undefined}
        onAdminUsernameChange={() => undefined}
        onAgentPasswordChange={() => undefined}
        onAgentUsernameChange={() => undefined}
        onGuestEnter={() => undefined}
        onInvitationCodeChange={() => undefined}
        onLoginAgent={() => undefined}
        onLoginAdmin={() => undefined}
        onLoginAccount={() => undefined}
        onModeChange={() => undefined}
        onPasswordChange={() => undefined}
        onRegister={() => undefined}
        onUsernameChange={() => undefined}
        password="demo123456"
        username="demo_user"
      />,
    );

    expect(html).toContain('游客登录');
    expect(html).toContain('代理');
    expect(html).toContain('代理邀请码');
    expect(html).toContain('登录');
    expect(html).not.toContain('收益明细');
  });

  it('renders agent login fields in agent mode', () => {
    const html = renderToStaticMarkup(
      <LoginPage
        adminPassword="admin123456"
        adminUsername="admin"
        agentPassword="demo-agent-pass"
        agentUsername="demo_default_agent"
        invitationCode=""
        busyAction=""
        mode="agent"
        onAdminPasswordChange={() => undefined}
        onAdminUsernameChange={() => undefined}
        onAgentPasswordChange={() => undefined}
        onAgentUsernameChange={() => undefined}
        onGuestEnter={() => undefined}
        onInvitationCodeChange={() => undefined}
        onLoginAgent={() => undefined}
        onLoginAdmin={() => undefined}
        onLoginAccount={() => undefined}
        onModeChange={() => undefined}
        onPasswordChange={() => undefined}
        onRegister={() => undefined}
        onUsernameChange={() => undefined}
        password="demo123456"
        username="demo_user"
      />,
    );

    expect(html).toContain('代理账号');
    expect(html).toContain('代理密码');
    expect(html).not.toContain('注册');
  });

  it('disables guest entry while account login is busy', () => {
    const html = renderToStaticMarkup(
      <LoginPage
        adminPassword="admin123456"
        adminUsername="admin"
        agentPassword="demo-agent-pass"
        agentUsername="demo_default_agent"
        invitationCode=""
        busyAction="login"
        mode="account"
        onAdminPasswordChange={() => undefined}
        onAdminUsernameChange={() => undefined}
        onAgentPasswordChange={() => undefined}
        onAgentUsernameChange={() => undefined}
        onGuestEnter={() => undefined}
        onInvitationCodeChange={() => undefined}
        onLoginAgent={() => undefined}
        onLoginAdmin={() => undefined}
        onLoginAccount={() => undefined}
        onModeChange={() => undefined}
        onPasswordChange={() => undefined}
        onRegister={() => undefined}
        onUsernameChange={() => undefined}
        password="demo123456"
        username="demo_user"
      />,
    );

    expect(html).toContain(
      '<button class="ui-button ui-button-ghost" type="button" disabled="">游客登录</button>',
    );
  });
});

describe('ECPM App state helpers', () => {
  it('merges refreshed ECPM update jobs without dropping loaded detail items', () => {
    const detailedJob: EcpmUpdateJob = {
      ...ecpmUpdateJob,
      items: [
        {
          createdAt: '2026-05-08T00:00:00.000Z',
          dataHour: '2026-05-08T00:00:00.000Z',
          errorMessage: null,
          gameAppId: 'ks_game_001',
          gameId: 'game-1',
          id: 'ecpm-update-item-1',
          jobId: ecpmUpdateJob.id,
          kuaishouSyncJobId: null,
          openId: 'open-1',
          savedCount: 1,
          skipReason: null,
          status: 'SUCCEEDED',
          updatedAt: '2026-05-08T00:00:30.000Z',
          userId: 'user-1',
        },
      ],
    };
    const refreshedJob: EcpmUpdateJob = {
      ...ecpmUpdateJob,
      finishedAt: '2026-05-08T00:01:00.000Z',
      savedCount: 2,
      status: 'SUCCEEDED',
      updatedAt: '2026-05-08T00:01:00.000Z',
    };

    expect(mergeEcpmUpdateJob(detailedJob, refreshedJob)).toMatchObject({
      finishedAt: '2026-05-08T00:01:00.000Z',
      items: detailedJob.items,
      savedCount: 2,
      status: 'SUCCEEDED',
    });
  });

  it('reconciles selected ECPM update job against refreshed lists', () => {
    const selectedJob: EcpmUpdateJob = {
      ...ecpmUpdateJob,
      items: [],
      status: 'RUNNING',
    };
    const refreshedJob: EcpmUpdateJob = {
      ...ecpmUpdateJob,
      finishedAt: '2026-05-08T00:01:00.000Z',
      status: 'SUCCEEDED',
      updatedAt: '2026-05-08T00:01:00.000Z',
    };

    expect(
      reconcileSelectedEcpmUpdateJob(selectedJob, [refreshedJob]),
    ).toMatchObject({
      finishedAt: '2026-05-08T00:01:00.000Z',
      items: [],
      status: 'SUCCEEDED',
    });
    expect(reconcileSelectedEcpmUpdateJob(selectedJob, [])).toBeUndefined();
  });

  it('applies only the latest current-session ECPM job-list response', () => {
    expect(shouldApplyEcpmUpdateJobsResponse(2, 2, true)).toBe(true);
    expect(shouldApplyEcpmUpdateJobsResponse(1, 2, true)).toBe(false);
    expect(shouldApplyEcpmUpdateJobsResponse(2, 2, false)).toBe(false);
  });
});

describe('AgentWorkspace', () => {
  it('renders agent profile, earnings, alipay, and withdrawal panels', () => {
    const html = renderToStaticMarkup(
      <AgentWorkspace
        agent={{
          id: 'agent-1',
          invitationCode: 'AGENT1',
          username: 'agent_1',
        }}
        alipayAccount=""
        alipayRealName=""
        busyAction=""
        onLoadUsers={() => undefined}
        onAlipayAccountChange={() => undefined}
        onAlipayRealNameChange={() => undefined}
        onLoadEarnings={() => undefined}
        onLoadWithdrawals={() => undefined}
        onRequestWithdrawal={() => undefined}
        onUpdateAlipayProfile={() => undefined}
        onWithdrawalAmountChange={() => undefined}
        withdrawalAmountYuan="10.00"
        users={{
          rows: [
            {
              createdAt: '2026-05-10T00:00:00.000Z',
              currentAgentId: 'agent-1',
              currentAgentInvitationCode: 'AGENT1',
              currentAgentUsername: 'agent_1',
              id: 'user-1',
              readableId: 'USER001',
              relation: 'DIRECT',
              username: 'direct_user',
            },
          ],
          totalCount: 1,
        }}
      />,
    );

    expect(html).toContain('代理收益概览');
    expect(html).toContain('代理支付宝资料');
    expect(html).toContain('代理提现申请');
    expect(html).toContain('代理结算明细');
    expect(html).toContain('代理名下用户');
    expect(html).toContain('direct_user');
    expect(html).toContain('代理提现批次');
  });
});

describe('GuestQueryPage', () => {
  it('renders single ID query controls', () => {
    const html = renderToStaticMarkup(
      <GuestQueryPage
        busy={false}
        identity=""
        onIdentityChange={() => undefined}
        onQuery={() => undefined}
      />,
    );

    expect(html).toContain('单个 ID 查询');
    expect(html).toContain('open_id / 可读 ID');
  });
});

describe('AccountWorkspace', () => {
  it('renders account forms and account earnings table', () => {
    const html = renderToStaticMarkup(
      <AccountWorkspace
        agentBinding={{ agent: null }}
        agentInvitationCode=""
        alipayAccount=""
        alipayRealName=""
        bindIdentity=""
        busyAction=""
        onAgentInvitationCodeChange={() => undefined}
        onBindAgent={() => undefined}
        onAlipayAccountChange={() => undefined}
        onAlipayRealNameChange={() => undefined}
        onBindIdentityChange={() => undefined}
        onBindOpenId={() => undefined}
        onQueryAccountEarnings={() => undefined}
        onRequestWithdrawal={() => undefined}
        onUpdateAlipayProfile={() => undefined}
        onWithdrawalAmountChange={() => undefined}
        withdrawalAmountYuan="10.00"
      />,
    );

    expect(html).toContain('ID 绑定');
    expect(html).toContain('代理归属');
    expect(html).toContain('支付宝资料');
    expect(html).toContain('提现申请');
    expect(html).toContain('账号收益明细');
  });

  it('disables all account actions while one workspace action is busy', () => {
    const html = renderToStaticMarkup(
      <AccountWorkspace
        account={{
          id: 'account-1',
          readableId: '1234567',
          username: 'demo_user',
        }}
        agentBinding={{
          agent: {
            id: 'agent-1',
            invitationCode: 'AGENT1',
            parentAgentId: null,
            username: 'agent_1',
          },
        }}
        agentInvitationCode="AGENT2"
        alipayAccount="demo@example.com"
        alipayRealName="Demo User"
        bindIdentity="open-id-1"
        busyAction="withdrawal"
        onAgentInvitationCodeChange={() => undefined}
        onBindAgent={() => undefined}
        onAlipayAccountChange={() => undefined}
        onAlipayRealNameChange={() => undefined}
        onBindIdentityChange={() => undefined}
        onBindOpenId={() => undefined}
        onQueryAccountEarnings={() => undefined}
        onRequestWithdrawal={() => undefined}
        onUpdateAlipayProfile={() => undefined}
        onWithdrawalAmountChange={() => undefined}
        withdrawalAmountYuan="10.00"
      />,
    );

    expect(html.match(/<button\b[^>]*disabled=""/g)).toHaveLength(5);
    expect(html).toContain('提交中');
    expect(html).toContain('等待管理员确认结算');
    expect(html).not.toMatch(/<button\b[^>]*>.*确认结算.*<\/button>/);
  });
});

describe('OperationsWorkspace', () => {
  it('renders the business function rail and defaults to overview pane', () => {
    const html = renderToStaticMarkup(
      <OperationsWorkspace {...operationsWorkspaceProps()} />,
    );

    expect(html).toContain('运营功能栏');
    expect(html).toContain('class="operations-feature-nav-label">总览</span>');
    expect(html).toContain('class="operations-feature-rail"');
    const railLabels = [
      '公司',
      '游戏',
      'ECPM 看板',
      '快手',
      '结算',
      '提现',
      '代理',
      '审计',
      '配置',
    ];
    const railPositions = railLabels.map((label) =>
      html.indexOf(`class="operations-feature-nav-label">${label}</span>`),
    );
    expect(railPositions.every((position) => position >= 0)).toBe(true);
    expect(railPositions).toEqual([...railPositions].sort((a, b) => a - b));
    expect(html).toContain('class="operations-feature-nav-label">公司</span>');
    expect(html).toContain('公司相关操作');
    expect(html).toContain('class="operations-feature-nav-label">游戏</span>');
    expect(html).toContain('游戏相关操作');
    expect(html).toContain('class="operations-feature-nav-label">ECPM 看板</span>');
    expect(html).toContain('查询/更新/报告');
    expect(html).toContain('授权/同步');
    expect(html).toContain('结算确认');
    expect(html).toContain('提现审核');
    expect(html).toContain('审计追踪');
    expect(html).toContain('代理管理');
    expect(html).toContain(
      'class="operations-feature-nav-label">配置</span>',
    );
    expect(html).toContain('平台配置');
    expect(html).not.toContain(
      'class="operations-feature-nav-label">权限</span>',
    );
    expect(html).not.toContain(
      'class="operations-feature-nav-label">维护</span>',
    );
    expect(html).not.toContain('operations-nav');
    expect(html).toContain('operations-pane operations-pane-active');
  });

  it('hides maintenance pane for company admins', () => {
    const html = renderToStaticMarkup(
      <OperationsWorkspace
        {...operationsWorkspaceProps({
          isSuperAdmin: false,
        })}
      />,
    );

    expect(html).not.toContain('测试数据维护');
    expect(html).not.toContain('清空测试数据');
    expect(html).not.toContain('公司管理员管理');
    expect(html).not.toContain('平台业务配置');
  });

  it('keeps company admins read-only in company and game panes', () => {
    const html = renderToStaticMarkup(
      <OperationsWorkspace
        {...operationsWorkspaceProps({
          adminCompanies: [adminCompany],
          adminGames: [adminGame],
          configGameDraft: {
            ecpmAutoSyncEnabled: true,
            ecpmAutoSyncIntervalHours: 3,
            gameSecret: 'secret-1',
            name: 'Runner',
            settlementPaused: false,
          },
          configSection: 'basic',
          isSuperAdmin: false,
          selectedConfigGame: adminGame,
          selectedConfigGameId: 'game-1',
        })}
      />,
    );

    expect(html).toContain('公司管理');
    expect(html).toContain('游戏管理');
    expect(html).toContain('Acme Studio');
    expect(html).toContain('Runner');
    expect(html).not.toContain('配置');
    expect(html).not.toContain('game_secret');
    expect(html).not.toContain('保存配置');
    expect(html).not.toContain('分配预算');
    expect(html).not.toContain('手动刷新 ECPM');
    expect(html).not.toContain('换取 open_id');
    expect(html).not.toContain('刷新游戏 ECPM');
    expect(html).not.toContain('创建公司');
    expect(html).not.toContain('充值公司余额');
    expect(html).not.toContain('创建游戏');
    expect(html).not.toContain('分配游戏预算');
    expect(html).not.toContain('打开创建公司弹窗');
    expect(html).not.toContain('打开预算分配弹窗');
  });

  it('keeps company admins read-only for Kuaishou authorization and settlement', () => {
    const html = renderToStaticMarkup(
      <OperationsWorkspace
        {...operationsWorkspaceProps({
          isSuperAdmin: false,
          settlementPreview: confirmableSettlementPreview,
        })}
      />,
    );

    expect(html).toContain('平台授权');
    expect(html).toContain('结算确认');
    expect(html).toContain('预览结算');
    expect(html).not.toContain('提交授权');
    expect(html).not.toContain('刷新 token');
    expect(html).not.toContain('确认结算');
  });

  it('keeps company admins read-only for withdrawal batches', () => {
    const html = renderToStaticMarkup(
      <OperationsWorkspace
        {...operationsWorkspaceProps({
          adminWithdrawals: [
            withdrawalBatch,
            {
              ...withdrawalBatch,
              id: 'withdrawal-batch-2',
              status: 'APPROVED',
            },
            {
              ...withdrawalBatch,
              id: 'withdrawal-batch-3',
              status: 'FAILED',
            },
          ],
          isSuperAdmin: false,
        })}
      />,
    );

    const withdrawalPanel = html.slice(
      html.indexOf('<h2 class="ui-panel-title">提现审核</h2>'),
      html.indexOf('<h2 class="ui-panel-title">审计日志</h2>'),
    );

    expect(withdrawalPanel).toContain('withdrawal-batch-1');
    expect(withdrawalPanel).not.toContain('详情');
    expect(withdrawalPanel).not.toContain('<th>操作</th>');
    expect(html).not.toMatch(/<button\b[^>]*>通过<\/button>/);
    expect(html).not.toMatch(/<button\b[^>]*>打款<\/button>/);
    expect(html).not.toMatch(/<button\b[^>]*>失败<\/button>/);
    expect(html).not.toMatch(/<button\b[^>]*>关闭<\/button>/);
  });

  it('hides stale withdrawal detail for company admins', () => {
    const html = renderToStaticMarkup(
      <OperationsWorkspace
        {...operationsWorkspaceProps({
          isSuperAdmin: false,
          selectedWithdrawalDetail: withdrawalDetail,
        })}
      />,
    );

    expect(html).not.toContain('提现详情');
    expect(html).not.toContain('withdrawal-batch-1');
    expect(html).not.toContain('Demo User');
    expect(html).toContain('运营总览');
    expect(html).toContain('operations-pane operations-pane-active');
  });

  it('keeps game integration in the game pane and Kuaishou focused on authorization and sync', () => {
    const html = renderToStaticMarkup(
      <OperationsWorkspace {...operationsWorkspaceProps()} />,
    );
    const gameIndex = html.indexOf('游戏管理');
    const integrationIndex = html.indexOf('游戏端登录');
    const ecpmIndex = html.indexOf('ECPM 看板等待接入');
    const authorizationIndex = html.indexOf(
      '<h2 class="ui-panel-title">平台授权</h2>',
    );
    const syncIndex = html.indexOf('<h2 class="ui-panel-title">同步任务</h2>');

    expect(gameIndex).toBeGreaterThanOrEqual(0);
    expect(integrationIndex).toBeGreaterThan(gameIndex);
    expect(integrationIndex).toBeLessThan(ecpmIndex);
    expect(authorizationIndex).toBeGreaterThan(ecpmIndex);
    expect(syncIndex).toBeGreaterThan(authorizationIndex);
  });

  it('renders an ECPM wiring fallback until operations handlers are supplied', () => {
    const html = renderToStaticMarkup(
      <OperationsWorkspace {...operationsWorkspaceProps()} />,
    );

    expect(html).toContain('ECPM 看板等待接入');
    expect(html).toContain('等待 Task 9 接入数据与操作回调');
    expect(html).not.toContain('ECPM 数据');
    expect(html).not.toContain('更新报告');
  });

  it('renders the ECPM operations center when handlers are supplied', () => {
    const html = renderToStaticMarkup(
      <OperationsWorkspace
        {...operationsWorkspaceProps({
          onEcpmDashboardQuery: () => undefined,
          onEcpmJobSelect: () => undefined,
          onEcpmUpdate: () => undefined,
        })}
      />,
    );

    expect(html).toContain('ECPM 数据');
    expect(html).toContain('更新报告');
    expect(html).not.toContain('ECPM 看板等待接入');
  });

  it('shows a super-admin ECPM report refresh action when supplied', () => {
    const html = renderToStaticMarkup(
      <OperationsWorkspace
        {...operationsWorkspaceProps({
          onEcpmDashboardQuery: () => undefined,
          onEcpmJobSelect: () => undefined,
          onEcpmJobsRefresh: () => undefined,
          onEcpmUpdate: () => undefined,
        })}
      />,
    );

    expect(html).toContain('刷新更新报告');
  });

  it('lets company admins use dashboard-only ECPM wiring with update disabled', () => {
    const html = renderToStaticMarkup(
      <OperationsWorkspace
        {...operationsWorkspaceProps({
          isSuperAdmin: false,
          onEcpmDashboardQuery: () => undefined,
        })}
      />,
    );

    expect(html).toContain('ECPM 数据');
    expect(html).toContain('更新报告');
    expect(html).not.toContain('ECPM 看板等待接入');
    expect(html).not.toContain('刷新更新报告');
    expect(html).toContain(
      '<button class="ui-button ui-button-primary ui-button-compact" type="button" disabled="">更新</button>',
    );
  });

  it('disables ECPM controls while an unrelated workspace action is busy', () => {
    const html = renderToStaticMarkup(
      <OperationsWorkspace
        {...operationsWorkspaceProps({
          busyAction: 'admin-resources',
          onEcpmDashboardQuery: () => undefined,
          onEcpmJobSelect: () => undefined,
          onEcpmJobsRefresh: () => undefined,
          onEcpmUpdate: () => undefined,
        })}
      />,
    );

    expect(html).toContain(
      '<button class="ui-button ui-button-secondary ui-button-compact" type="button" disabled="">查询中</button>',
    );
    expect(html).toContain(
      '<button class="ui-button ui-button-primary ui-button-compact" type="button" disabled="">更新</button>',
    );
    expect(html).toContain(
      '<button class="ui-button ui-button-secondary ui-button-compact" type="button" disabled="">刷新更新报告</button>',
    );
  });

  it('disables ECPM controls while admin login resource loading is busy', () => {
    const html = renderToStaticMarkup(
      <OperationsWorkspace
        {...operationsWorkspaceProps({
          busyAction: 'admin-login',
          onEcpmDashboardQuery: () => undefined,
          onEcpmJobSelect: () => undefined,
          onEcpmJobsRefresh: () => undefined,
          onEcpmUpdate: () => undefined,
        })}
      />,
    );

    expect(html).toContain(
      '<button class="ui-button ui-button-secondary ui-button-compact" type="button" disabled="">查询中</button>',
    );
    expect(html).toContain(
      '<button class="ui-button ui-button-secondary ui-button-compact" type="button" disabled="">刷新更新报告</button>',
    );
  });

  it('renders platform config center for super admins', () => {
    const html = renderToStaticMarkup(
      <OperationsWorkspace
        {...operationsWorkspaceProps({
          platformConfig: {
            defaultAgentId: 'agent-default-1',
            defaultAgentRatioPercent: 5,
            directAgentRatioPercent: 10,
            displayRatioPercent: 60,
            feeRatioPercent: 5,
            minWithdrawal: { li: '20000', yuan: '20.00' },
            parentAgentRatioPercent: 10,
            userSettlementRatioPercent: 70,
          },
          platformConfigDraft: {
            defaultAgentId: 'agent-default-1',
            defaultAgentRatioPercent: '5',
            directAgentRatioPercent: '10',
            displayRatioPercent: '60',
            feeRatioPercent: '5',
            minWithdrawalYuan: '20.00',
            parentAgentRatioPercent: '10',
            userSettlementRatioPercent: '70',
          },
        })}
      />,
    );

    expect(html).toContain('配置中心');
    expect(html).toContain('平台业务配置');
    expect(html).toContain('展示金额比例');
    expect(html).toContain('用户结算比例');
    expect(html).toContain('直属代理比例');
    expect(html).toContain('最低提现金额');
    expect(html).toContain('保存平台配置');
    expect(html).toContain('分账合计：100%');
  });

  it('renders the super admin company admin management pane', () => {
    const html = renderToStaticMarkup(
      <OperationsWorkspace
        {...operationsWorkspaceProps({
          adminCompanies: [adminCompany],
          adminGames: [adminGame],
          companyAdmins: [companyAdminAccount],
        })}
      />,
    );

    expect(html).toContain('公司管理员管理');
    expect(html).toContain('打开创建账号弹窗');
    expect(html).toContain('acme_admin');
    expect(html).toContain('Acme 只读管理员');
    expect(html).toContain('已启用');
    expect(html).toContain('编辑账号');
    expect(html).toContain('分配范围');
  });

  it('renders operations overview metrics and exception summary', () => {
    const html = renderToStaticMarkup(
      <OperationsWorkspace
        {...operationsWorkspaceProps({
          adminGames: [
            {
              ...adminGame,
              budget: { li: '1200', yuan: '12.00' },
              settlementPaused: false,
            },
            {
              ...adminGame,
              budget: { li: '800', yuan: '8.00' },
              gameAppId: 'ks_game_002',
              id: 'game-2',
              name: 'Puzzle',
              settlementPaused: true,
            },
          ],
          configKuaishouEcpmJobs: [
            {
              ...kuaishouEcpmJob,
              errorMessage: 'token expired',
              id: 'job-failed-2',
              status: 'FAILED',
            },
          ],
          kuaishouEcpmJobs: [
            {
              ...kuaishouEcpmJob,
              errorMessage: 'token expired',
              id: 'job-failed-1',
              status: 'FAILED',
            },
          ],
          settlementPreview: {
            ...confirmableSettlementPreview,
            settlementAmount: { li: '500', yuan: '5.00' },
            settlementCount: 3,
          },
        })}
      />,
    );

    expect(html).toContain('运营总览');
    expect(html).toContain('今日收益');
    expect(html).toContain('游戏预算余额');
    expect(html).toContain('待结算金额');
    expect(html).toContain('异常任务数');
    expect(html).toContain('游戏排行');
    expect(html).toContain('异常摘要');
  });

  it('renders business closure checks in the overview pane', () => {
    const html = renderToStaticMarkup(
      <OperationsWorkspace
        {...operationsWorkspaceProps({
          businessClosure: businessClosureReport,
        })}
      />,
    );

    expect(html).toContain('真实数据闭环核对');
    expect(html).toContain('公司 / 游戏 / 预算');
    expect(html).toContain('用户代理归属');
    expect(html).toContain('公司 1 个');
    expect(html).toContain('刷新核对');
  });

  it('renders overview empty states when admin data is missing', () => {
    const html = renderToStaticMarkup(
      <OperationsWorkspace
        {...operationsWorkspaceProps({
          adminGames: [],
          configKuaishouEcpmJobs: [],
          kuaishouEcpmJobs: [],
          settlementPreview: undefined,
        })}
      />,
    );

    expect(html).toContain('暂无可用游戏排行');
    expect(html).toContain('暂无异常任务');
    expect(html).toContain('请先创建游戏并分配预算');
    expect(html).toContain('可点击“刷新任务”检查最新同步状态');
  });

  it('renders admin operations sections', () => {
    const html = renderToStaticMarkup(
      <OperationsWorkspace {...operationsWorkspaceProps({ gameAppId: '' })} />,
    );

    expect(html).toContain('游戏端登录');
    expect(html).toContain('快手 ECPM');
    expect(html).toContain('结算确认');
    expect(html).toContain('预览结算');
    expect(html).toContain('打开确认弹窗');
    expect(html).toContain('提现审核');
    expect(html).toContain('审计日志');
  });

  it('disables all top-level actions while an operations action is busy', () => {
    const html = renderToStaticMarkup(
      <OperationsWorkspace
        {...operationsWorkspaceProps({
          adminName: 'admin',
          busyAction: 'refresh',
          games: [
            {
              ...adminGame,
              gameAppId: 'game-1',
              id: 'game-row-1',
            },
          ],
          jsCode: 'real-js-code',
        })}
      />,
    );

    expect(html.match(/<button\b[^>]*disabled=""/g)?.length ?? 0).toBeGreaterThanOrEqual(8);
    expect(html).toContain('换取 open_id');
    expect(html).toContain('刷新日志');
  });

  it('requires a confirmable settlement preview before enabling super-admin confirmation', () => {
    const withoutPreview = renderToStaticMarkup(
      <OperationsWorkspace {...operationsWorkspaceProps()} />,
    );
    const withPreview = renderToStaticMarkup(
      <OperationsWorkspace
        {...operationsWorkspaceProps({
          settlementPreview: confirmableSettlementPreview,
        })}
      />,
    );

    expect(withoutPreview).toContain(
      '<button class="ui-button ui-button-primary" type="button" disabled="">打开确认弹窗</button>',
    );
    expect(withPreview).toContain(
      '<button class="ui-button ui-button-primary" type="button">打开确认弹窗</button>',
    );
  });

  it('renders server-provided settlement batch rows', () => {
    const html = renderToStaticMarkup(
      <OperationsWorkspace
        {...operationsWorkspaceProps({
          settlementBatches: [serverSettlementBatch],
        })}
      />,
    );

    expect(html).toContain('settlement-batch-1');
    expect(html).toContain('CONFIRMED');
    expect(html).toContain('¥ 30.00');
    expect(html).toContain('¥ 70.00');
    expect(html).not.toContain('暂无结算批次');
    expect(html).toContain('查看明细');
  });

  it('renders settlement split detail with user, agent, default, and fee amounts', () => {
    const html = renderToStaticMarkup(
      <OperationsWorkspace
        {...operationsWorkspaceProps({
          selectedSettlementDetail: settlementDetail,
          settlementBatches: [serverSettlementBatch],
        })}
      />,
    );

    expect(html).toContain('结算明细');
    expect(html).toContain('open-1');
    expect(html).toContain('user-1');
    expect(html).toContain('agent-direct-1');
    expect(html).toContain('agent-parent-1');
    expect(html).toContain('¥ 0.70');
    expect(html).toContain('¥ 0.10');
    expect(html).toContain('¥ 0.05');
  });

  it('renders company and game management panes with their related actions', () => {
    const html = renderToStaticMarkup(
      <OperationsWorkspace
        {...operationsWorkspaceProps({
          adminCompanies: [adminCompany],
          adminGames: [adminGame],
          balanceAmountYuan: '100.00',
          balanceCompanyId: 'company-1',
          budgetAmountYuan: '6.00',
          budgetGameId: 'game-1',
          newCompanyName: 'New Studio',
          newGameAppId: 'ks_game_002',
          newGameCompanyId: 'company-1',
          newGameName: 'Runner 2',
          newGameSecret: 'secret-2',
        })}
      />,
    );

    expect(html).toContain('公司管理');
    expect(html).toContain('游戏管理');
    expect(html).toContain('Acme Studio');
    expect(html).toContain('¥ 12.35');
    expect(html).toContain('Runner');
    expect(html).toContain('ks_game_001');
    expect(html).toContain('¥ 6.00');
    expect(html).toContain('已暂停');
    expect(html).toContain('打开创建公司弹窗');
    expect(html).toContain('打开充值弹窗');
    expect(html).toContain('打开创建游戏弹窗');
    expect(html).toContain('打开预算分配弹窗');
  });

  it('renders a config button for each admin game', () => {
    const html = renderToStaticMarkup(
      <OperationsWorkspace
        {...operationsWorkspaceProps({
          adminGames: [
            adminGame,
            {
              ...adminGame,
              gameAppId: 'ks_game_002',
              id: 'game-2',
              name: 'Puzzle',
            },
          ],
        })}
      />,
    );

    expect(html.match(/lucide-settings/g)).toHaveLength(2);
  });

  it('renders selected game config modules and ecpm sync policy copy', () => {
    const html = renderToStaticMarkup(
      <OperationsWorkspace
        {...operationsWorkspaceProps({
          adminGames: [adminGame],
          configGameDraft: {
            ecpmAutoSyncEnabled: false,
            ecpmAutoSyncIntervalHours: 3,
            gameSecret: 'secret-1',
            name: 'Runner',
            settlementPaused: true,
          },
          configSection: 'ecpm',
          selectedConfigGame: adminGame,
          selectedConfigGameId: 'game-1',
        })}
      />,
    );

    expect(html).toContain('游戏配置');
    expect(html).toContain('基础信息');
    expect(html).toContain('预算与结算');
    expect(html).toContain('ECPM 同步');
    expect(html).toContain('审计/任务历史');
    expect(html).toContain('默认关闭');
    expect(html).toContain('失败不会自动重试');
  });

  it('filters selected game config history by game_app_id only', () => {
    const html = renderToStaticMarkup(
      <OperationsWorkspace
        {...operationsWorkspaceProps({
          adminGames: [adminGame],
          configGameDraft: {
            ecpmAutoSyncEnabled: false,
            ecpmAutoSyncIntervalHours: 3,
            gameSecret: 'secret-1',
            name: 'Runner',
            settlementPaused: true,
          },
          configKuaishouEcpmJobs: [
            kuaishouEcpmJob,
            {
              ...kuaishouEcpmJob,
              gameAppId: 'game-1',
              id: 'job-row-id',
            },
          ],
          configSection: 'audit',
          selectedConfigGame: adminGame,
          selectedConfigGameId: 'game-1',
        })}
      />,
    );

    expect(html).toContain('job-1');
    expect(html).not.toContain('job-row-id');
  });

  it('renders kuaishou platform authorization status and controls', () => {
    const html = renderToStaticMarkup(
      <OperationsWorkspace
        {...operationsWorkspaceProps({
          kuaishouAppId: 'app-1',
          kuaishouAuthCode: 'auth-code-1',
          kuaishouSecret: 'secret-1',
          kuaishouTokenStatus,
        })}
      />,
    );

    expect(html).toContain('平台授权');
    expect(html).toContain('已授权');
    expect(html).toContain('database');
    expect(html).toContain('advertiser-1');
    expect(html).toContain('2026-05-09');
    expect(html).toContain('打开授权弹窗');
    expect(html).toContain('直接刷新 token');
    expect(html).toContain('授权回调地址');
    expect(html).toContain('auth_code=AUTH_CODE');
    expect(html).not.toContain('access-token');
    expect(html).not.toContain('refresh-token');
  });

  it('renders recent kuaishou ecpm sync jobs', () => {
    const html = renderToStaticMarkup(
      <OperationsWorkspace
        {...operationsWorkspaceProps({
          kuaishouEcpmJobs: [
            kuaishouEcpmJob,
            {
              ...kuaishouEcpmJob,
              errorMessage: 'token expired',
              id: 'job-2',
              status: 'FAILED',
            },
          ],
        })}
      />,
    );

    expect(html).toContain('同步任务');
    expect(html).toContain('job-1');
    expect(html).toContain('SUCCEEDED');
    expect(html).toContain('FAILED');
    expect(html).toContain('token expired');
    expect(html).toContain('kuaishou');
  });

  it('renders retry actions for failed kuaishou ecpm sync jobs', () => {
    const html = renderToStaticMarkup(
      <OperationsWorkspace
        {...operationsWorkspaceProps({
          kuaishouEcpmJobs: [
            {
              ...kuaishouEcpmJob,
              errorMessage: 'token expired',
              id: 'job-failed-1',
              status: 'FAILED',
            },
          ],
        })}
      />,
    );

    expect(html).toContain('重试失败任务');
    expect(html).toContain('job-failed-1');
  });
});

describe('settlement range helpers', () => {
  it('clears a stale settlement preview when a range field changes', () => {
    const result = changeSettlementRange(
      {
        gameAppId: 'game-1',
        settlementEndDate: '2026-05-08',
        settlementPreview: confirmableSettlementPreview,
        settlementStartDate: '2026-05-08',
        settlementUserId: '',
      },
      { settlementUserId: 'user-1' },
    );

    expect(result.settlementUserId).toBe('user-1');
    expect(result.settlementPreview).toBeUndefined();
  });

  it('maps the selected game app id to the backend game row id', () => {
    const gameId = getSettlementGameRowId(
      [
        {
          ...adminGame,
          companyName: 'Real Studio',
          gameAppId: 'demo_ks_game',
          id: 'demo-game-001',
          name: 'Real Game',
        },
      ],
      'demo_ks_game',
    );

    expect(gameId).toBe('demo-game-001');
    expect(gameId).not.toBe('demo_ks_game');
  });

  it('falls back to the first game row id for admin entry batch loading', () => {
    const gameId = getAdminEntrySettlementGameRowId(
      [
        {
          ...adminGame,
          companyName: 'Real Studio',
          gameAppId: 'demo_ks_game',
          id: 'demo-game-001',
          name: 'Real Game',
        },
      ],
      '',
    );

    expect(gameId).toBe('demo-game-001');
  });

  it('rejects stale settlement batch responses', () => {
    expect(shouldApplySettlementBatchResponse(1, 2, true)).toBe(false);
    expect(shouldApplySettlementBatchResponse(2, 2, true)).toBe(true);
    expect(shouldApplySettlementBatchResponse(2, 2, false)).toBe(false);
  });

  it('builds settlement API ranges with the backend game row id', () => {
    const range = buildSettlementRange({
      endDate: '2026-05-08',
      gameId: 'demo-game-001',
      startDate: '2026-05-08',
      userId: ' user-1 ',
    });

    expect(range).toEqual({
      endDate: '2026-05-08',
      gameId: 'demo-game-001',
      startDate: '2026-05-08',
      userId: 'user-1',
    });
    expect(range.gameId).not.toBe('demo_ks_game');
  });
});

describe('admin resource helpers', () => {
  it('keeps a valid selected company id and falls back to the first company', () => {
    expect(getDefaultAdminCompanyId([adminCompany], 'company-1')).toBe(
      'company-1',
    );
    expect(getDefaultAdminCompanyId([adminCompany], 'missing-company')).toBe(
      'company-1',
    );
    expect(getDefaultAdminCompanyId([], 'company-1')).toBe('');
  });

  it('keeps a valid selected game id and falls back to the first game', () => {
    expect(getDefaultAdminGameId([adminGame], 'game-1')).toBe('game-1');
    expect(getDefaultAdminGameId([adminGame], 'missing-game')).toBe('game-1');
    expect(getDefaultAdminGameId([], 'game-1')).toBe('');
  });
});

describe('kuaishou token helpers', () => {
  it('keeps an entered platform app id and otherwise falls back to token status', () => {
    expect(getDefaultKuaishouAppId(kuaishouTokenStatus, 'typed-app')).toBe(
      'typed-app',
    );
    expect(getDefaultKuaishouAppId(kuaishouTokenStatus, '')).toBe('app-1');
    expect(
      getDefaultKuaishouAppId(
        {
          ...kuaishouTokenStatus,
          appId: null,
        },
        '',
      ),
    ).toBe('');
  });

  it('reads kuaishou OAuth callback query parameters from auth_code or code', () => {
    expect(
      readKuaishouOAuthCallback('?auth_code=auth-1&app_id=app-1'),
    ).toEqual({
      appId: 'app-1',
      authCode: 'auth-1',
    });
    expect(readKuaishouOAuthCallback('?code=auth-2')).toEqual({
      appId: '',
      authCode: 'auth-2',
    });
    expect(readKuaishouOAuthCallback('?state=ignored')).toBeUndefined();
  });
});
