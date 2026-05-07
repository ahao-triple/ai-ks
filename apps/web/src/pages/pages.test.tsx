import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { LoginPage } from './LoginPage';
import { GuestQueryPage } from './GuestQueryPage';
import { AccountWorkspace } from './AccountWorkspace';

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
        onConfirmSettlement={() => undefined}
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
});
