import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { LoginPage } from './LoginPage';
import { GuestQueryPage } from './GuestQueryPage';
import { AccountWorkspace } from './AccountWorkspace';
import {
  OperationsWorkspace,
  type OperationsWorkspaceProps,
} from './OperationsWorkspace';
import {
  buildSettlementRange,
  changeSettlementRange,
  getDefaultAdminCompanyId,
  getDefaultAdminGameId,
  getDefaultKuaishouAppId,
  getAdminEntrySettlementGameRowId,
  getSettlementGameRowId,
  shouldApplySettlementBatchResponse,
} from '../App';
import type {
  AdminCompany,
  AdminGame,
  AdminSettlementBatch,
  AdminSettlementPreview,
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

function operationsWorkspaceProps(
  overrides: Partial<OperationsWorkspaceProps> = {},
): OperationsWorkspaceProps {
  return {
    adminName: '',
    adminCompanies: [],
    adminGames: [],
    adminWithdrawalStatus: 'PENDING_REVIEW',
    adminWithdrawals: [],
    auditLogs: [],
    balanceAmountYuan: '',
    balanceCompanyId: '',
    balanceReason: '',
    budgetAmountYuan: '',
    budgetGameId: '',
    budgetReason: '',
    busyAction: '',
    configBudgetAmountYuan: '',
    configBudgetReason: '',
    configEcpmLookbackHours: 3,
    configGameDraft: undefined,
    configKuaishouEcpmJobs: [],
    configSection: 'basic',
    gameAppId: 'game-1',
    games: [],
    jsCode: '',
    kuaishouAppId: '',
    kuaishouAuthCode: '',
    kuaishouEcpmJobs: [],
    kuaishouSecret: '',
    newCompanyName: '',
    newGameAppId: '',
    newGameCompanyId: '',
    newGameName: '',
    newGameSecret: '',
    onAdjustCompanyBalance: () => undefined,
    onAllocateGameBudget: () => undefined,
    onApproveWithdrawal: () => undefined,
    onBalanceAmountChange: () => undefined,
    onBalanceCompanyIdChange: () => undefined,
    onBalanceReasonChange: () => undefined,
    onBudgetAmountChange: () => undefined,
    onBudgetGameIdChange: () => undefined,
    onBudgetReasonChange: () => undefined,
    onCloseWithdrawal: () => undefined,
    onConfirmSettlement: () => undefined,
    onCloseGameConfig: () => undefined,
    onCreateCompany: () => undefined,
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
    onLoadAuditLogs: () => undefined,
    onLoadWithdrawalDetail: () => undefined,
    onLoadWithdrawals: () => undefined,
    onNewCompanyNameChange: () => undefined,
    onNewGameAppIdChange: () => undefined,
    onNewGameCompanyIdChange: () => undefined,
    onNewGameNameChange: () => undefined,
    onNewGameSecretChange: () => undefined,
    onPayWithdrawal: () => undefined,
    onPreviewSettlement: () => undefined,
    onRefreshEcpm: () => undefined,
    onRefreshConfigGameEcpm: () => undefined,
    onSaveGameConfig: () => undefined,
    onSettlementEndDateChange: () => undefined,
    onSettlementStartDateChange: () => undefined,
    onSettlementUserIdChange: () => undefined,
    onOpenGameConfig: () => undefined,
    onSubmitConfigBudget: () => undefined,
    sampleJsCodes: [],
    selectedConfigGame: undefined,
    selectedConfigGameId: '',
    settlementBatches: [],
    settlementEndDate: '2026-05-08',
    settlementStartDate: '2026-05-08',
    settlementUserId: '',
    ...overrides,
  };
}

describe('LoginPage', () => {
  it('renders a clean login page with guest entry', () => {
    const html = renderToStaticMarkup(
      <LoginPage
        adminPassword="admin123456"
        adminUsername="admin"
        busyAction=""
        mode="account"
        onAdminPasswordChange={() => undefined}
        onAdminUsernameChange={() => undefined}
        onGuestEnter={() => undefined}
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
    expect(html).toContain('登录');
    expect(html).not.toContain('收益明细');
  });

  it('disables guest entry while account login is busy', () => {
    const html = renderToStaticMarkup(
      <LoginPage
        adminPassword="admin123456"
        adminUsername="admin"
        busyAction="login"
        mode="account"
        onAdminPasswordChange={() => undefined}
        onAdminUsernameChange={() => undefined}
        onGuestEnter={() => undefined}
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
        alipayAccount=""
        alipayRealName=""
        bindIdentity=""
        busyAction=""
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
        alipayAccount="demo@example.com"
        alipayRealName="Demo User"
        bindIdentity="open-id-1"
        busyAction="withdrawal"
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

    expect(html.match(/<button\b[^>]*disabled=""/g)).toHaveLength(4);
    expect(html).toContain('提交中');
    expect(html).toContain('等待管理员确认结算');
    expect(html).not.toMatch(/<button\b[^>]*>.*确认结算.*<\/button>/);
  });
});

describe('OperationsWorkspace', () => {
  it('renders admin operations sections', () => {
    const html = renderToStaticMarkup(
      <OperationsWorkspace {...operationsWorkspaceProps({ gameAppId: '' })} />,
    );

    expect(html).toContain('游戏端登录');
    expect(html).toContain('快手 ECPM');
    expect(html).toContain('结算确认');
    expect(html).toContain('预览结算');
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
              companyName: 'Demo Studio',
              gameAppId: 'game-1',
              id: 'game-row-1',
              name: 'Demo Game',
            },
          ],
          jsCode: 'mock-js-code-001',
        })}
      />,
    );

    expect(html.match(/<button\b[^>]*disabled=""/g)?.length ?? 0).toBeGreaterThanOrEqual(8);
    expect(html).toContain('换取 open_id');
    expect(html).toContain('刷新日志');
  });

  it('requires a confirmable settlement preview before enabling confirmation', () => {
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
      '<button class="ui-button ui-button-primary" type="button" disabled="">确认结算</button>',
    );
    expect(withPreview).toContain(
      '<button class="ui-button ui-button-primary" type="button">确认结算</button>',
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
  });

  it('renders the admin budget management panel with companies and games', () => {
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

    expect(html).toContain('预算管理');
    expect(html).toContain('Acme Studio');
    expect(html).toContain('¥ 12.35');
    expect(html).toContain('Runner');
    expect(html).toContain('ks_game_001');
    expect(html).toContain('¥ 6.00');
    expect(html).toContain('已暂停');
    expect(html).toContain('创建公司');
    expect(html).toContain('充值公司余额');
    expect(html).toContain('创建游戏');
    expect(html).toContain('分配游戏预算');
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

    expect(html.match(/配置/g)).toHaveLength(2);
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
    expect(html).toContain('ACTIVE');
    expect(html).toContain('database');
    expect(html).toContain('advertiser-1');
    expect(html).toContain('2026-05-09');
    expect(html).toContain('提交授权');
    expect(html).toContain('刷新 token');
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
          companyName: 'Demo Studio',
          gameAppId: 'demo_ks_game',
          id: 'demo-game-001',
          name: 'Demo Game',
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
          companyName: 'Demo Studio',
          gameAppId: 'demo_ks_game',
          id: 'demo-game-001',
          name: 'Demo Game',
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
});
