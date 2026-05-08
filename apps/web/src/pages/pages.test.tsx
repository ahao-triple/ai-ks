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
  getAdminEntrySettlementGameRowId,
  getSettlementGameRowId,
  shouldApplySettlementBatchResponse,
} from '../App';
import type {
  AdminSettlementBatch,
  AdminSettlementPreview,
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

function operationsWorkspaceProps(
  overrides: Partial<OperationsWorkspaceProps> = {},
): OperationsWorkspaceProps {
  return {
    adminName: '',
    adminWithdrawalStatus: 'PENDING_REVIEW',
    adminWithdrawals: [],
    auditLogs: [],
    busyAction: '',
    gameAppId: 'game-1',
    games: [],
    jsCode: '',
    onApproveWithdrawal: () => undefined,
    onCloseWithdrawal: () => undefined,
    onConfirmSettlement: () => undefined,
    onCreateSession: () => undefined,
    onGameChange: () => undefined,
    onJsCodeChange: () => undefined,
    onLoadAuditLogs: () => undefined,
    onLoadWithdrawalDetail: () => undefined,
    onLoadWithdrawals: () => undefined,
    onPayWithdrawal: () => undefined,
    onPreviewSettlement: () => undefined,
    onRefreshEcpm: () => undefined,
    onSettlementEndDateChange: () => undefined,
    onSettlementStartDateChange: () => undefined,
    onSettlementUserIdChange: () => undefined,
    sampleJsCodes: [],
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

    expect(html.match(/<button\b[^>]*disabled=""/g)).toHaveLength(8);
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
