import { useEffect, useMemo, useRef, useState } from 'react';
import {
  createGuestSession,
  createSignedOutSession,
  type AppSession,
  type ViewKey,
} from './app/session';
import { Alert } from './components/ui';
import { DashboardLayout } from './layouts/DashboardLayout';
import { ApiError } from './lib/api';
import { aiKsApi } from './lib/aiKsApi';
import {
  ACCOUNT_AUTH_STORAGE_KEY,
  ADMIN_AUTH_STORAGE_KEY,
  clearStoredToken,
  readStoredToken,
  writeStoredToken,
} from './lib/auth';
import {
  AccountWorkspace,
  type AccountWorkspaceBusyAction,
} from './pages/AccountWorkspace';
import { GuestQueryPage } from './pages/GuestQueryPage';
import {
  LoginPage,
  type LoginBusyAction,
  type LoginMode,
} from './pages/LoginPage';
import {
  OperationsWorkspace,
  type OperationsWorkspaceBusyAction,
} from './pages/OperationsWorkspace';
import type {
  AccountEarningsResult,
  AccountResult,
  AdminWithdrawalBatch,
  AdminWithdrawalDetailResult,
  AuditLogRow,
  DemoGame,
  EarningsResult,
  EcpmRefreshResult,
  GameSessionResult,
  IntegrationStatus,
  SettlementResult,
  WithdrawalResult,
} from './types/api';

type AppBusyAction =
  | LoginBusyAction
  | AccountWorkspaceBusyAction
  | OperationsWorkspaceBusyAction
  | 'query';

type AuthScope = 'account' | 'admin' | 'none';

export function App() {
  const [activeView, setActiveView] = useState<ViewKey>('query');
  const [loginMode, setLoginMode] = useState<LoginMode>('account');
  const [appSession, setAppSession] = useState<AppSession>(() =>
    createSignedOutSession(),
  );
  const [games, setGames] = useState<DemoGame[]>([]);
  const [sampleJsCodes, setSampleJsCodes] = useState<string[]>([]);
  const [status, setStatus] = useState<IntegrationStatus>();
  const [gameAppId, setGameAppId] = useState('');
  const [jsCode, setJsCode] = useState('');
  const [gameSession, setGameSession] = useState<GameSessionResult>();
  const [refreshResult, setRefreshResult] = useState<EcpmRefreshResult>();
  const [identity, setIdentity] = useState('');
  const [bindIdentity, setBindIdentity] = useState('');
  const [earnings, setEarnings] = useState<EarningsResult>();
  const [username, setUsername] = useState('demo_user');
  const [password, setPassword] = useState('demo123456');
  const [account, setAccount] = useState<AccountResult>();
  const [accessToken, setAccessToken] = useState(() =>
    readStoredToken(ACCOUNT_AUTH_STORAGE_KEY),
  );
  const [adminAccessToken, setAdminAccessToken] = useState(() =>
    readStoredToken(ADMIN_AUTH_STORAGE_KEY),
  );
  const [adminUsername, setAdminUsername] = useState('admin');
  const [adminPassword, setAdminPassword] = useState('admin123456');
  const [adminName, setAdminName] = useState('');
  const [accountEarnings, setAccountEarnings] =
    useState<AccountEarningsResult>();
  const [alipayAccount, setAlipayAccount] = useState('');
  const [alipayRealName, setAlipayRealName] = useState('');
  const [withdrawalAmountYuan, setWithdrawalAmountYuan] = useState('10.00');
  const [withdrawal, setWithdrawal] = useState<WithdrawalResult>();
  const [settlement, setSettlement] = useState<SettlementResult>();
  const [adminWithdrawals, setAdminWithdrawals] = useState<
    AdminWithdrawalBatch[]
  >([]);
  const [adminWithdrawalStatus, setAdminWithdrawalStatus] =
    useState('PENDING_REVIEW');
  const [auditLogs, setAuditLogs] = useState<AuditLogRow[]>([]);
  const [selectedWithdrawalDetail, setSelectedWithdrawalDetail] =
    useState<AdminWithdrawalDetailResult>();
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyAction, setBusyAction] = useState<AppBusyAction>('');
  const busyRef = useRef(false);
  const sessionVersionRef = useRef(0);

  const selectedGame = useMemo(
    () => games.find((game) => game.gameAppId === gameAppId),
    [gameAppId, games],
  );
  const modeText =
    status?.kuaishouApiMode === 'mock'
      ? '快手 Mock'
      : status?.kuaishouApiMode === 'real'
        ? '快手 Real'
        : '接口状态未知';

  useEffect(() => {
    void initializeApp();
  }, []);

  function bumpSessionVersion() {
    sessionVersionRef.current += 1;
  }

  function isCurrentSessionVersion(version: number) {
    return sessionVersionRef.current === version;
  }

  function clearBusyState() {
    busyRef.current = false;
    setBusyAction('');
  }

  async function initializeApp() {
    const restoreVersion = sessionVersionRef.current;
    setError('');

    try {
      const [context, integrationStatus] = await Promise.all([
        aiKsApi.getDemoContext(),
        aiKsApi.getIntegrationStatus(),
      ]);

      setGames(context.games);
      setSampleJsCodes(context.sampleJsCodes);
      setStatus(integrationStatus);
      setGameAppId((current) => current || context.games[0]?.gameAppId || '');
      setJsCode(
        (current) =>
          current || context.sampleJsCodes[0] || 'mock-js-code-001',
      );

      if (accessToken) {
        try {
          const currentAccount = await aiKsApi.getCurrentAccount(accessToken);
          if (!isCurrentSessionVersion(restoreVersion)) {
            return;
          }

          setAccount(currentAccount);
          setAppSession({
            accessToken,
            account: currentAccount,
            mode: 'account',
          });
          setActiveView('account');
        } catch (nextError) {
          if (!isCurrentSessionVersion(restoreVersion)) {
            return;
          }

          if (nextError instanceof ApiError && nextError.status === 401) {
            clearAccountAuth();
          } else {
            setError(
              nextError instanceof Error
                ? nextError.message
                : '请求失败，请检查 API',
            );
          }
          return;
        }

        try {
          await loadAlipayProfile(accessToken, () =>
            isCurrentSessionVersion(restoreVersion),
          );
        } catch (nextError) {
          if (!isCurrentSessionVersion(restoreVersion)) {
            return;
          }

          if (nextError instanceof ApiError && nextError.status === 401) {
            clearAccountAuth();
          } else {
            setError(
              nextError instanceof Error
                ? nextError.message
                : '请求失败，请检查 API',
            );
          }
        }
      }
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : '无法连接 API，请确认后端服务已启动',
      );
    }
  }

  async function runAction(
    name: AppBusyAction,
    action: (isCurrent: () => boolean) => Promise<void>,
    authScope: AuthScope = 'none',
  ) {
    if (busyRef.current) {
      return;
    }

    const actionVersion = sessionVersionRef.current;
    busyRef.current = true;
    setBusyAction(name);
    setError('');
    setNotice('');

    try {
      await action(() => isCurrentSessionVersion(actionVersion));
    } catch (nextError) {
      if (!isCurrentSessionVersion(actionVersion)) {
        return;
      }

      if (nextError instanceof ApiError && nextError.status === 401) {
        handleUnauthorized(authScope);
        setError(nextError.message);
      } else if (nextError instanceof Error) {
        setError(nextError.message);
      } else {
        setError('请求失败，请检查 API');
      }
    } finally {
      if (isCurrentSessionVersion(actionVersion)) {
        clearBusyState();
      }
    }
  }

  function handleUnauthorized(authScope: AuthScope) {
    if (authScope === 'account') {
      clearAccountAuth();
    }

    if (authScope === 'admin') {
      clearAdminAuth();
    }
  }

  function clearAccountAuth() {
    clearStoredToken(ACCOUNT_AUTH_STORAGE_KEY);
    setAccessToken('');
    setAccount(undefined);
    setAccountEarnings(undefined);
    setAlipayAccount('');
    setAlipayRealName('');
    setWithdrawal(undefined);
    setSettlement(undefined);
    setAppSession(createSignedOutSession());
    setActiveView('query');
  }

  function clearAdminAuth() {
    clearStoredToken(ADMIN_AUTH_STORAGE_KEY);
    setAdminAccessToken('');
    setAdminName('');
    setAdminWithdrawals([]);
    setAuditLogs([]);
    setSelectedWithdrawalDetail(undefined);
    setAppSession(createSignedOutSession());
    setActiveView('query');
  }

  async function queryEarnings() {
    const targetIdentity = identity.trim();
    if (!targetIdentity) {
      setError('请输入 open_id 或可读 ID');
      return;
    }

    await runAction('query', async (isCurrent) => {
      const result = await aiKsApi.queryGuestEarnings(targetIdentity);
      if (!isCurrent()) {
        return;
      }

      setEarnings(result);
      setNotice('收益查询成功');
    });
  }

  async function registerAccount() {
    await runAction('register', async (isCurrent) => {
      const result = await aiKsApi.registerAccount({ password, username });
      if (!isCurrent()) {
        return;
      }

      await persistAccountAuth(
        result.accessToken,
        result.account,
        '账号注册成功',
      );
    }, 'account');
  }

  async function loginAccount() {
    await runAction('login', async (isCurrent) => {
      const result = await aiKsApi.loginAccount({ password, username });
      if (!isCurrent()) {
        return;
      }

      await persistAccountAuth(
        result.accessToken,
        result.account,
        '账号登录成功',
      );
    }, 'account');
  }

  async function loginAdmin() {
    await runAction('admin-login', async (isCurrent) => {
      const result = await aiKsApi.loginAdmin({
        password: adminPassword,
        username: adminUsername,
      });
      if (!isCurrent()) {
        return;
      }

      bumpSessionVersion();
      writeStoredToken(ADMIN_AUTH_STORAGE_KEY, result.accessToken);
      setAdminAccessToken(result.accessToken);
      setAdminName(result.admin.username);
      setAppSession({
        accessToken: result.accessToken,
        adminName: result.admin.username,
        mode: 'admin',
      });
      setActiveView('operations');
      setNotice('管理员登录成功');
      clearBusyState();
    }, 'admin');
  }

  async function persistAccountAuth(
    token: string,
    nextAccount: AccountResult,
    successNotice: string,
  ) {
    bumpSessionVersion();
    const accountVersion = sessionVersionRef.current;
    const isCurrent = () => isCurrentSessionVersion(accountVersion);

    writeStoredToken(ACCOUNT_AUTH_STORAGE_KEY, token);
    setAccessToken(token);
    setAccount(nextAccount);
    setAppSession({ accessToken: token, account: nextAccount, mode: 'account' });
    setActiveView('account');
    setNotice(successNotice);
    clearBusyState();

    try {
      await loadAlipayProfile(token, isCurrent);
    } catch (nextError) {
      if (!isCurrent()) {
        return;
      }

      if (nextError instanceof ApiError && nextError.status === 401) {
        clearAccountAuth();
      }

      setError(
        nextError instanceof Error ? nextError.message : '请求失败，请检查 API',
      );
    }
  }

  function enterGuestMode() {
    bumpSessionVersion();
    clearBusyState();
    setAppSession(createGuestSession());
    setActiveView('query');
    setError('');
    setNotice('');
  }

  function signOut() {
    bumpSessionVersion();
    clearBusyState();
    clearStoredToken(ACCOUNT_AUTH_STORAGE_KEY);
    clearStoredToken(ADMIN_AUTH_STORAGE_KEY);
    setAccessToken('');
    setAdminAccessToken('');
    setUsername('');
    setPassword('');
    setAdminUsername('');
    setAdminPassword('');
    setAccount(undefined);
    setAdminName('');
    setAppSession(createSignedOutSession());
    setActiveView('query');
    setGameSession(undefined);
    setRefreshResult(undefined);
    setIdentity('');
    setBindIdentity('');
    setEarnings(undefined);
    setAccountEarnings(undefined);
    setAlipayAccount('');
    setAlipayRealName('');
    setWithdrawal(undefined);
    setSettlement(undefined);
    setAdminWithdrawals([]);
    setAuditLogs([]);
    setSelectedWithdrawalDetail(undefined);
    setError('');
    setNotice('');
  }

  async function createGameSession() {
    await runAction('session', async (isCurrent) => {
      const result = await aiKsApi.createGameSession({ gameAppId, jsCode });
      if (!isCurrent()) {
        return;
      }

      setGameSession(result);
      setIdentity(result.openId);
      setBindIdentity(result.openId);
      setNotice('open_id 获取成功');
    });
  }

  async function refreshEcpm() {
    if (!adminAccessToken) {
      setError('请先登录管理员账号');
      return;
    }

    await runAction('refresh', async (isCurrent) => {
      const result = await aiKsApi.refreshEcpm(adminAccessToken, gameAppId);
      if (!isCurrent()) {
        return;
      }

      setRefreshResult(result);
      setNotice(`ECPM 刷新成功，写入 ${result.savedCount} 条明细`);
    }, 'admin');
  }

  async function bindAccountOpenId() {
    if (!account || !accessToken) {
      setError('请先登录或注册账号');
      return;
    }

    const targetIdentity = bindIdentity.trim();
    if (!targetIdentity) {
      setError('请输入要绑定的 open_id 或可读 ID');
      return;
    }

    await runAction('bind', async (isCurrent) => {
      await aiKsApi.bindAccountOpenId(accessToken, targetIdentity);
      if (!isCurrent()) {
        return;
      }

      const result = await aiKsApi.getAccountEarnings(accessToken);
      if (!isCurrent()) {
        return;
      }

      setAccountEarnings(result);
      setNotice('open_id 绑定成功');
    }, 'account');
  }

  async function queryAccountEarnings() {
    if (!account || !accessToken) {
      setError('请先登录或注册账号');
      return;
    }

    await runAction('account-query', async (isCurrent) => {
      const result = await aiKsApi.getAccountEarnings(accessToken);
      if (!isCurrent()) {
        return;
      }

      setAccountEarnings(result);
      setNotice('账号收益查询成功');
    }, 'account');
  }

  async function loadAlipayProfile(token: string, isCurrent = () => true) {
    const profile = await aiKsApi.getAlipayProfile(token);
    if (!isCurrent()) {
      return;
    }

    setAlipayAccount(profile.alipayAccount ?? '');
    setAlipayRealName(profile.alipayRealName ?? '');
  }

  async function updateAlipayProfile() {
    if (!accessToken) {
      setError('请先登录或注册账号');
      return;
    }

    await runAction('alipay', async (isCurrent) => {
      const profile = await aiKsApi.updateAlipayProfile(accessToken, {
        alipayAccount,
        alipayRealName,
      });
      if (!isCurrent()) {
        return;
      }

      setAlipayAccount(profile.alipayAccount ?? '');
      setAlipayRealName(profile.alipayRealName ?? '');
      setNotice('支付宝资料已保存');
    }, 'account');
  }

  async function requestWithdrawal() {
    if (!accessToken) {
      setError('请先登录或注册账号');
      return;
    }

    await runAction('withdrawal', async (isCurrent) => {
      const result = await aiKsApi.requestWithdrawal(
        accessToken,
        withdrawalAmountYuan,
      );
      if (!isCurrent()) {
        return;
      }

      setWithdrawal(result);
      setNotice('提现申请已提交，等待审核');
    }, 'account');
  }

  async function confirmSettlement() {
    if (!accessToken) {
      setError('请先登录或注册账号');
      return;
    }

    await runAction('settlement', async (isCurrent) => {
      const result = await aiKsApi.confirmSettlement(accessToken);
      if (!isCurrent()) {
        return;
      }

      setSettlement(result);
      setNotice(
        `确认结算 ${result.settledCount} 条，入账 ¥ ${result.settledAmount.yuan}`,
      );
      const earningsResult = await aiKsApi.getAccountEarnings(accessToken);
      if (!isCurrent()) {
        return;
      }

      setAccountEarnings(earningsResult);
    }, 'account');
  }

  async function loadAdminWithdrawals(statusFilter = adminWithdrawalStatus) {
    if (!adminAccessToken) {
      setError('请先登录管理员账号');
      return;
    }

    await runAction('admin-withdrawals', async (isCurrent) => {
      const result = await aiKsApi.getAdminWithdrawals(
        adminAccessToken,
        statusFilter,
      );
      if (!isCurrent()) {
        return;
      }

      setAdminWithdrawals(result.batches);
      setAdminWithdrawalStatus(statusFilter);
      setNotice(`提现批次 ${result.batches.length} 笔`);
    }, 'admin');
  }

  async function approveAdminWithdrawal(batchId: string) {
    if (!adminAccessToken) {
      setError('请先登录管理员账号');
      return;
    }

    await runAction(`approve-${batchId}`, async (isCurrent) => {
      const result = await aiKsApi.approveWithdrawal(
        adminAccessToken,
        batchId,
      );
      if (!isCurrent()) {
        return;
      }

      setAdminWithdrawals((current) =>
        current.filter((batch) => batch.id !== result.id),
      );
      clearSelectedWithdrawalDetail(result.id);
      setNotice(`提现批次 ${result.id} 已审核通过`);
    }, 'admin');
  }

  async function payAdminWithdrawal(
    batchId: string,
    mockResult: 'failed' | 'success' = 'success',
  ) {
    if (!adminAccessToken) {
      setError('请先登录管理员账号');
      return;
    }

    await runAction(`pay-${mockResult}-${batchId}`, async (isCurrent) => {
      const result = await aiKsApi.payWithdrawal(
        adminAccessToken,
        batchId,
        mockResult,
      );
      if (!isCurrent()) {
        return;
      }

      setAdminWithdrawals((current) =>
        current.filter((batch) => batch.id !== result.id),
      );
      clearSelectedWithdrawalDetail(result.id);
      setNotice(
        mockResult === 'failed'
          ? `提现批次 ${result.id} 已标记失败`
          : `提现批次 ${result.id} 已打款`,
      );
    }, 'admin');
  }

  async function closeAdminWithdrawal(batchId: string) {
    if (!adminAccessToken) {
      setError('请先登录管理员账号');
      return;
    }

    await runAction(`close-${batchId}`, async (isCurrent) => {
      const result = await aiKsApi.closeWithdrawal(adminAccessToken, batchId);
      if (!isCurrent()) {
        return;
      }

      setAdminWithdrawals((current) =>
        current.filter((batch) => batch.id !== result.id),
      );
      clearSelectedWithdrawalDetail(result.id);
      setNotice(`提现批次 ${result.id} 已关闭并退回冻结金额`);
    }, 'admin');
  }

  async function loadWithdrawalDetail(batchId: string) {
    if (!adminAccessToken) {
      setError('请先登录管理员账号');
      return;
    }

    await runAction(`detail-${batchId}`, async (isCurrent) => {
      const result = await aiKsApi.getWithdrawalDetail(
        adminAccessToken,
        batchId,
      );
      if (!isCurrent()) {
        return;
      }

      setSelectedWithdrawalDetail(result);
      setNotice(`已加载提现批次 ${batchId}`);
    }, 'admin');
  }

  async function loadAuditLogs() {
    if (!adminAccessToken) {
      setError('请先登录管理员账号');
      return;
    }

    await runAction('audit-logs', async (isCurrent) => {
      const result = await aiKsApi.getAuditLogs(adminAccessToken);
      if (!isCurrent()) {
        return;
      }

      setAuditLogs(result.logs);
      setNotice(`审计日志 ${result.logs.length} 条`);
    }, 'admin');
  }

  function clearSelectedWithdrawalDetail(batchId: string) {
    setSelectedWithdrawalDetail((current) =>
      current?.batch.id === batchId ? undefined : current,
    );
  }

  const alerts = (
    <>
      {error ? (
        <Alert role="alert" tone="danger">
          {error}
        </Alert>
      ) : null}
      {notice ? <Alert tone="success">{notice}</Alert> : null}
    </>
  );

  if (appSession.mode === 'signed-out') {
    return (
      <>
        {alerts}
        <LoginPage
          adminPassword={adminPassword}
          adminUsername={adminUsername}
          busyAction={loginBusyAction(busyAction)}
          mode={loginMode}
          onAdminPasswordChange={setAdminPassword}
          onAdminUsernameChange={setAdminUsername}
          onGuestEnter={enterGuestMode}
          onLoginAccount={loginAccount}
          onLoginAdmin={loginAdmin}
          onModeChange={setLoginMode}
          onPasswordChange={setPassword}
          onRegister={registerAccount}
          onUsernameChange={setUsername}
          password={password}
          username={username}
        />
      </>
    );
  }

  return (
    <DashboardLayout
      activeView={activeView}
      modeText={modeText}
      onNavigate={setActiveView}
      onSignOut={signOut}
      session={appSession}
    >
      {alerts}
      {activeView === 'query' ? (
        <GuestQueryPage
          busy={busyAction === 'query'}
          earnings={earnings}
          identity={identity}
          onIdentityChange={setIdentity}
          onQuery={queryEarnings}
          selectedGame={selectedGame}
        />
      ) : null}
      {activeView === 'account' && appSession.mode === 'account' ? (
        <AccountWorkspace
          account={account}
          accountEarnings={accountEarnings}
          alipayAccount={alipayAccount}
          alipayRealName={alipayRealName}
          bindIdentity={bindIdentity}
          busyAction={accountBusyAction(busyAction)}
          onAlipayAccountChange={setAlipayAccount}
          onAlipayRealNameChange={setAlipayRealName}
          onBindIdentityChange={setBindIdentity}
          onBindOpenId={bindAccountOpenId}
          onConfirmSettlement={confirmSettlement}
          onQueryAccountEarnings={queryAccountEarnings}
          onRequestWithdrawal={requestWithdrawal}
          onUpdateAlipayProfile={updateAlipayProfile}
          onWithdrawalAmountChange={setWithdrawalAmountYuan}
          settlement={settlement}
          withdrawal={withdrawal}
          withdrawalAmountYuan={withdrawalAmountYuan}
        />
      ) : null}
      {activeView === 'operations' && appSession.mode === 'admin' ? (
        <OperationsWorkspace
          adminName={adminName}
          adminWithdrawalStatus={adminWithdrawalStatus}
          adminWithdrawals={adminWithdrawals}
          auditLogs={auditLogs}
          busyAction={operationsBusyAction(busyAction)}
          gameAppId={gameAppId}
          games={games}
          jsCode={jsCode}
          onApproveWithdrawal={approveAdminWithdrawal}
          onCloseWithdrawal={closeAdminWithdrawal}
          onCreateSession={createGameSession}
          onGameChange={setGameAppId}
          onJsCodeChange={setJsCode}
          onLoadAuditLogs={loadAuditLogs}
          onLoadWithdrawalDetail={loadWithdrawalDetail}
          onLoadWithdrawals={loadAdminWithdrawals}
          onPayWithdrawal={payAdminWithdrawal}
          onRefreshEcpm={refreshEcpm}
          refreshResult={refreshResult}
          sampleJsCodes={sampleJsCodes}
          selectedGame={selectedGame}
          selectedWithdrawalDetail={selectedWithdrawalDetail}
          session={gameSession}
        />
      ) : null}
    </DashboardLayout>
  );
}

function loginBusyAction(action: AppBusyAction): LoginBusyAction {
  switch (action) {
    case 'admin-login':
    case 'login':
    case 'register':
      return action;
    default:
      return '';
  }
}

function accountBusyAction(action: AppBusyAction): AccountWorkspaceBusyAction {
  switch (action) {
    case 'account-query':
    case 'alipay':
    case 'bind':
    case 'settlement':
    case 'withdrawal':
      return action;
    default:
      return '';
  }
}

function operationsBusyAction(
  action: AppBusyAction,
): OperationsWorkspaceBusyAction {
  if (isOperationsBusyAction(action)) {
    return action;
  }

  return '';
}

function isOperationsBusyAction(
  action: AppBusyAction,
): action is OperationsWorkspaceBusyAction {
  switch (action) {
    case 'admin-withdrawals':
    case 'audit-logs':
    case 'refresh':
    case 'session':
      return true;
    default:
      return (
        action.startsWith('approve-') ||
        action.startsWith('close-') ||
        action.startsWith('detail-') ||
        action.startsWith('pay-failed-') ||
        action.startsWith('pay-success-')
      );
  }
}
