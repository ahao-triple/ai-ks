import { LogIn, UserPlus } from 'lucide-react';
import { AuthLayout } from '../layouts/AuthLayout';
import { Button, InputField } from '../components/ui';

export type LoginMode = 'account' | 'admin';
export type LoginBusyAction = '' | 'admin-login' | 'login' | 'register';

export interface LoginPageProps {
  adminPassword: string;
  adminUsername: string;
  busyAction: LoginBusyAction;
  mode: LoginMode;
  onAdminPasswordChange(value: string): void;
  onAdminUsernameChange(value: string): void;
  onGuestEnter(): void;
  onLoginAccount(): void;
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
  busyAction,
  mode,
  onAdminPasswordChange,
  onAdminUsernameChange,
  onGuestEnter,
  onLoginAccount,
  onLoginAdmin,
  onModeChange,
  onPasswordChange,
  onRegister,
  onUsernameChange,
  password,
  username,
}: LoginPageProps) {
  const isAdmin = mode === 'admin';
  const activeUsername = isAdmin ? adminUsername : username;
  const activePassword = isAdmin ? adminPassword : password;
  const canSubmit =
    activeUsername.trim().length > 0 && activePassword.trim().length > 0;
  const loginBusyAction = isAdmin ? 'admin-login' : 'login';
  const authBusy = busyAction !== '';

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
      </div>

      <div className="form-stack">
        <InputField
          label={isAdmin ? '管理员账号' : '账号'}
          onChange={isAdmin ? onAdminUsernameChange : onUsernameChange}
          value={activeUsername}
        />
        <InputField
          label={isAdmin ? '管理员密码' : '密码'}
          onChange={isAdmin ? onAdminPasswordChange : onPasswordChange}
          type="password"
          value={activePassword}
        />
        <Button
          disabled={authBusy || !canSubmit}
          icon={<LogIn size={16} />}
          onClick={isAdmin ? onLoginAdmin : onLoginAccount}
        >
          {busyAction === loginBusyAction ? '登录中' : '登录'}
        </Button>
        {!isAdmin ? (
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
