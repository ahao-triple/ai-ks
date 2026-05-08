import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { LoginPage } from './LoginPage';
import { GuestQueryPage } from './GuestQueryPage';
import { AccountWorkspace } from './AccountWorkspace';
import { OperationsWorkspace } from './OperationsWorkspace';

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
      <OperationsWorkspace
        adminName=""
        adminWithdrawalStatus="PENDING_REVIEW"
        adminWithdrawals={[]}
        auditLogs={[]}
        busyAction=""
        gameAppId=""
        games={[]}
        jsCode=""
        onApproveWithdrawal={() => undefined}
        onCloseWithdrawal={() => undefined}
        onCreateSession={() => undefined}
        onGameChange={() => undefined}
        onJsCodeChange={() => undefined}
        onLoadAuditLogs={() => undefined}
        onLoadWithdrawalDetail={() => undefined}
        onLoadWithdrawals={() => undefined}
        onPayWithdrawal={() => undefined}
        onRefreshEcpm={() => undefined}
        sampleJsCodes={[]}
      />,
    );

    expect(html).toContain('游戏端登录');
    expect(html).toContain('快手 ECPM');
    expect(html).toContain('提现审核');
    expect(html).toContain('审计日志');
  });

  it('disables all top-level actions while an operations action is busy', () => {
    const html = renderToStaticMarkup(
      <OperationsWorkspace
        adminName="admin"
        adminWithdrawalStatus="PENDING_REVIEW"
        adminWithdrawals={[]}
        auditLogs={[]}
        busyAction="refresh"
        gameAppId="game-1"
        games={[
          {
            companyName: 'Demo Studio',
            gameAppId: 'game-1',
            id: 'game-row-1',
            name: 'Demo Game',
          },
        ]}
        jsCode="mock-js-code-001"
        onApproveWithdrawal={() => undefined}
        onCloseWithdrawal={() => undefined}
        onCreateSession={() => undefined}
        onGameChange={() => undefined}
        onJsCodeChange={() => undefined}
        onLoadAuditLogs={() => undefined}
        onLoadWithdrawalDetail={() => undefined}
        onLoadWithdrawals={() => undefined}
        onPayWithdrawal={() => undefined}
        onRefreshEcpm={() => undefined}
        sampleJsCodes={[]}
      />,
    );

    expect(html.match(/<button\b[^>]*disabled=""/g)).toHaveLength(6);
    expect(html).toContain('换取 open_id');
    expect(html).toContain('刷新日志');
  });
});
