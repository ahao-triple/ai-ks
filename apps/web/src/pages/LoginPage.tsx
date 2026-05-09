import { LogIn, UserPlus } from 'lucide-react';
import { AuthLayout } from '../layouts/AuthLayout';
import { Button, InputField } from '../components/ui';

export type LoginMode = 'account' | 'admin' | 'agent';
export type LoginBusyAction =
  | ''
  | 'admin-login'
  | 'agent-login'
  | 'login'
  | 'register';

export interface LoginPageProps {
  adminPassword: string;
  adminUsername: string;
  agentPassword: string;
  agentUsername: string;
  busyAction: LoginBusyAction;
  invitationCode: string;
  mode: LoginMode;
  onAdminPasswordChange(value: string): void;
  onAdminUsernameChange(value: string): void;
  onAgentPasswordChange(value: string): void;
  onAgentUsernameChange(value: string): void;
  onGuestEnter(): void;
  onInvitationCodeChange(value: string): void;
  onLoginAccount(): void;
  onLoginAgent(): void;
  onLoginAdmin(): void;
  onModeChange(mode: LoginMode): void;
  onPasswordChange(value: string): void;
  onRegister(): void;
  onUsernameChange(value: string): void;
  password: string;
  username: string;
}

export function LoginPage({
  adminPassword,
  adminUsername,
  agentPassword,
  agentUsername,
  busyAction,
  invitationCode,
  mode,
  onAdminPasswordChange,
  onAdminUsernameChange,
  onAgentPasswordChange,
  onAgentUsernameChange,
  onGuestEnter,
  onInvitationCodeChange,
  onLoginAccount,
  onLoginAgent,
  onLoginAdmin,
  onModeChange,
  onPasswordChange,
  onRegister,
  onUsernameChange,
  password,
  username,
}: LoginPageProps) {
  const isAdmin = mode === 'admin';
  const isAgent = mode === 'agent';
  const activeUsername = isAdmin
    ? adminUsername
    : isAgent
      ? agentUsername
      : username;
  const activePassword = isAdmin
    ? adminPassword
    : isAgent
      ? agentPassword
      : password;
  const canSubmit =
    activeUsername.trim().length > 0 && activePassword.trim().length > 0;
  const loginBusyAction = isAdmin
    ? 'admin-login'
    : isAgent
      ? 'agent-login'
      : 'login';
  const authBusy = busyAction !== '';
  const usernameLabel = isAdmin ? '管理员账号' : isAgent ? '代理账号' : '账号';
  const passwordLabel = isAdmin ? '管理员密码' : isAgent ? '代理密码' : '密码';
  const onActiveUsernameChange = isAdmin
    ? onAdminUsernameChange
    : isAgent
      ? onAgentUsernameChange
      : onUsernameChange;
  const onActivePasswordChange = isAdmin
    ? onAdminPasswordChange
    : isAgent
      ? onAgentPasswordChange
      : onPasswordChange;
  const onLogin = isAdmin ? onLoginAdmin : isAgent ? onLoginAgent : onLoginAccount;

  return (
    <AuthLayout>
      <div className="auth-copy">
        <h1>登录</h1>
        <p>进入收益结算后台</p>
      </div>

      <div className="segmented-control" role="tablist" aria-label="登录方式">
        <Button
          aria-pressed={!isAdmin}
          disabled={authBusy}
          onClick={() => onModeChange('account')}
          variant={!isAdmin ? 'primary' : 'secondary'}
        >
          用户
        </Button>
        <Button
          aria-pressed={isAdmin}
          disabled={authBusy}
          onClick={() => onModeChange('admin')}
          variant={isAdmin ? 'primary' : 'secondary'}
        >
          管理员
        </Button>
        <Button
          aria-pressed={isAgent}
          disabled={authBusy}
          onClick={() => onModeChange('agent')}
          variant={isAgent ? 'primary' : 'secondary'}
        >
          代理
        </Button>
      </div>

      <div className="form-stack">
        <InputField
          label={usernameLabel}
          onChange={onActiveUsernameChange}
          value={activeUsername}
        />
        <InputField
          label={passwordLabel}
          onChange={onActivePasswordChange}
          type="password"
          value={activePassword}
        />
        {!isAdmin && !isAgent ? (
          <InputField
            label="代理邀请码"
            onChange={onInvitationCodeChange}
            placeholder="可选，注册时绑定代理"
            value={invitationCode}
          />
        ) : null}
        <Button
          disabled={authBusy || !canSubmit}
          icon={<LogIn size={16} />}
          onClick={onLogin}
        >
          {busyAction === loginBusyAction ? '登录中' : '登录'}
        </Button>
        {!isAdmin && !isAgent ? (
          <Button
            disabled={authBusy || !canSubmit}
            icon={<UserPlus size={16} />}
            onClick={onRegister}
            variant="secondary"
          >
            {busyAction === 'register' ? '注册中' : '注册'}
          </Button>
        ) : null}
        <Button disabled={authBusy} onClick={onGuestEnter} variant="ghost">
          游客登录
        </Button>
      </div>
    </AuthLayout>
  );
}
