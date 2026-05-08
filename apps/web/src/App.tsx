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
  AdminCompany,
  AdminGame,
  AdminSettlementBatch,
  AdminSettlementPreview,
  AdminSettlementRange,
  AdminWithdrawalBatch,
  AdminWithdrawalDetailResult,
  AuditLogRow,
  DemoGame,
  EarningsResult,
  EcpmRefreshResult,
  GameSessionResult,
  IntegrationStatus,
  KuaishouEcpmSyncJob,
  KuaishouTokenStatusResult,
  WithdrawalResult,
} from './types/api';

type AppBusyAction =
  | LoginBusyAction
  | AccountWorkspaceBusyAction
  | OperationsWorkspaceBusyAction
  | 'query';

type AuthScope = 'account' | 'admin' | 'none';

type SettlementRangeState = {
  gameAppId: string;
  settlementEndDate: string;
  settlementPreview?: AdminSettlementPreview;
  settlementStartDate: string;
  settlementUserId: string;
};

function todayDateText() {
  return new Date().toISOString().slice(0, 10);
}

export function changeSettlementRange(
  state: SettlementRangeState,
  patch: Partial<Omit<SettlementRangeState, 'settlementPreview'>>,
): SettlementRangeState {
  return {
    ...state,
    ...patch,
    settlementPreview: undefined,
  };
}

export function buildSettlementRange({
  endDate,
  gameId,
  startDate,
  userId,
}: {
  endDate: string;
  gameId: string;
  startDate: string;
  userId?: string;
}): AdminSettlementRange {
  return {
    endDate,
    gameId,
    startDate,
    ...(userId?.trim() ? { userId: userId.trim() } : {}),
  };
}

export function getSettlementGameRowId(games: DemoGame[], gameAppId: string) {
  return games.find((game) => game.gameAppId === gameAppId)?.id ?? '';
}

export function getAdminEntrySettlementGameRowId(
  games: DemoGame[],
  gameAppId: string,
) {
  return getSettlementGameRowId(games, gameAppId || games[0]?.gameAppId || '');
}

export function getDefaultAdminCompanyId(
  companies: AdminCompany[],
  currentCompanyId: string,
) {
  return companies.some((company) => company.id === currentCompanyId)
    ? currentCompanyId
    : companies[0]?.id ?? '';
}

export function getDefaultAdminGameId(
  games: AdminGame[],
  currentGameId: string,
) {
  return games.some((game) => game.id === currentGameId)
    ? currentGameId
    : games[0]?.id ?? '';
}

export function getDefaultKuaishouAppId(
  status: KuaishouTokenStatusResult | undefined,
  currentAppId: string,
) {
  return currentAppId.trim() || status?.appId || '';
}

export function shouldApplySettlementBatchResponse(
  requestVersion: number,
  currentVersion: number,
  isCurrentSession: boolean,
) {
  return isCurrentSession && requestVersion === currentVersion;
}

export function App() {
  const [activeView, setActiveView] = useState<ViewKey>('query');
  const [loginMode, setLoginMode] = useState<LoginMode>('account');
  const [appSession, setAppSession] = useState<AppSession>(() =>
    createSignedOutSession(),
  );
  const [games, setGames] = useState<DemoGame[]>([]);
  const [sampleJsCodes, setSampleJsCodes] = useState<string[]>([]);
  const [status, setStatus] = useState<IntegrationStatus>();
  const [kuaishouTokenStatus, setKuaishouTokenStatus] =
    useState<KuaishouTokenStatusResult>();
  const [kuaishouEcpmJobs, setKuaishouEcpmJobs] = useState<
    KuaishouEcpmSyncJob[]
  >([]);
  const [kuaishouAppId, setKuaishouAppId] = useState('');
  const [kuaishouSecret, setKuaishouSecret] = useState('');
  const [kuaishouAuthCode, setKuaishouAuthCode] = useState('');
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
  const [adminCompanies, setAdminCompanies] = useState<AdminCompany[]>([]);
  const [adminGames, setAdminGames] = useState<AdminGame[]>([]);
  const [newCompanyName, setNewCompanyName] = useState('');
  const [balanceCompanyId, setBalanceCompanyId] = useState('');
  const [balanceAmountYuan, setBalanceAmountYuan] = useState('');
  const [balanceReason, setBalanceReason] = useState('');
  const [newGameCompanyId, setNewGameCompanyId] = useState('');
  const [newGameName, setNewGameName] = useState('');
  const [newGameAppId, setNewGameAppId] = useState('');
  const [newGameSecret, setNewGameSecret] = useState('');
  const [budgetGameId, setBudgetGameId] = useState('');
  const [budgetAmountYuan, setBudgetAmountYuan] = useState('');
  const [budgetReason, setBudgetReason] = useState('');
  const [accountEarnings, setAccountEarnings] =
    useState<AccountEarningsResult>();
  const [alipayAccount, setAlipayAccount] = useState('');
  const [alipayRealName, setAlipayRealName] = useState('');
  const [withdrawalAmountYuan, setWithdrawalAmountYuan] = useState('10.00');
  const [withdrawal, setWithdrawal] = useState<WithdrawalResult>();
  const [adminWithdrawals, setAdminWithdrawals] = useState<
    AdminWithdrawalBatch[]
  >([]);
  const [adminWithdrawalStatus, setAdminWithdrawalStatus] =
    useState('PENDING_REVIEW');
  const [auditLogs, setAuditLogs] = useState<AuditLogRow[]>([]);
  const [selectedWithdrawalDetail, setSelectedWithdrawalDetail] =
    useState<AdminWithdrawalDetailResult>();
  const [settlementStartDate, setSettlementStartDate] = useState(() =>
    todayDateText(),
  );
  const [settlementEndDate, setSettlementEndDate] = useState(() =>
    todayDateText(),
  );
  const [settlementUserId, setSettlementUserId] = useState('');
  const [settlementPreview, setSettlementPreview] =
    useState<AdminSettlementPreview>();
  const [settlementBatches, setSettlementBatches] = useState<
    AdminSettlementBatch[]
  >([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyAction, setBusyAction] = useState<AppBusyAction>('');
  const busyRef = useRef(false);
  const sessionVersionRef = useRef(0);
  const settlementBatchRequestVersionRef = useRef(0);

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

  useEffect(() => {
    if (appSession.mode !== 'admin' || !adminAccessToken) {
      return;
    }

    const settlementGameId = getAdminEntrySettlementGameRowId(games, gameAppId);
    if (!settlementGameId) {
      setSettlementBatches([]);
      return;
    }

    const batchSessionVersion = sessionVersionRef.current;
    void loadSettlementBatchesForGame(adminAccessToken, settlementGameId, () =>
      isCurrentSessionVersion(batchSessionVersion),
    );
  }, [adminAccessToken, appSession.mode, gameAppId, games]);

  useEffect(() => {
    if (appSession.mode !== 'admin' || !adminAccessToken) {
      return;
    }

    const resourceSessionVersion = sessionVersionRef.current;
    void loadAdminResourcesForToken(adminAccessToken, () =>
      isCurrentSessionVersion(resourceSessionVersion),
    );
  }, [adminAccessToken, appSession.mode]);

  useEffect(() => {
    if (appSession.mode !== 'admin' || !adminAccessToken) {
      return;
    }

    const tokenSessionVersion = sessionVersionRef.current;
    void loadKuaishouTokenStatusForToken(adminAccessToken, () =>
      isCurrentSessionVersion(tokenSessionVersion),
    );
  }, [adminAccessToken, appSession.mode]);

  useEffect(() => {
    if (appSession.mode !== 'admin' || !adminAccessToken) {
      return;
    }

    const jobSessionVersion = sessionVersionRef.current;
    void loadKuaishouEcpmJobsForToken(adminAccessToken, () =>
      isCurrentSessionVersion(jobSessionVersion),
    );
  }, [adminAccessToken, appSession.mode]);

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
      const restoredGameAppId = gameAppId || context.games[0]?.gameAppId || '';
      setGameAppId((current) => current || restoredGameAppId);
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

      if (!accessToken && adminAccessToken) {
        if (!isCurrentSessionVersion(restoreVersion)) {
          return;
        }

        const restoredAdminName = adminUsername || 'admin';
        setAdminName(restoredAdminName);
        setAppSession({
          accessToken: adminAccessToken,
          adminName: restoredAdminName,
          mode: 'admin',
        });
        setActiveView('operations');
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
    setAppSession(createSignedOutSession());
    setActiveView('query');
  }

  function clearAdminAuth() {
    bumpSessionVersion();
    clearBusyState();
    nextSettlementBatchRequestVersion();
    clearStoredToken(ADMIN_AUTH_STORAGE_KEY);
    setAdminAccessToken('');
    setAdminName('');
    clearAdminResourceState();
    clearKuaishouTokenState();
    setKuaishouEcpmJobs([]);
    setAdminWithdrawals([]);
    setAuditLogs([]);
    setSelectedWithdrawalDetail(undefined);
    setSettlementPreview(undefined);
    setSettlementBatches([]);
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
    clearAdminResourceState();
    clearKuaishouTokenState();
    setKuaishouEcpmJobs([]);
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
    setAdminWithdrawals([]);
    setAuditLogs([]);
    setSelectedWithdrawalDetail(undefined);
    setSettlementPreview(undefined);
    setSettlementBatches([]);
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
      setKuaishouEcpmJobs((current) => [result.job, ...current].slice(0, 20));
      const loaded = await loadKuaishouEcpmJobsForToken(
        adminAccessToken,
        isCurrent,
      );
      if (!isCurrent() || !loaded) {
        return;
      }

      setNotice(`ECPM 刷新成功，写入 ${result.savedCount} 条明细`);
    }, 'admin');
  }

  function clearAdminResourceState() {
    setAdminCompanies([]);
    setAdminGames([]);
    setNewCompanyName('');
    setBalanceCompanyId('');
    setBalanceAmountYuan('');
    setBalanceReason('');
    setNewGameCompanyId('');
    setNewGameName('');
    setNewGameAppId('');
    setNewGameSecret('');
    setBudgetGameId('');
    setBudgetAmountYuan('');
    setBudgetReason('');
  }

  function clearKuaishouTokenState() {
    setKuaishouTokenStatus(undefined);
    setKuaishouAppId('');
    setKuaishouSecret('');
    setKuaishouAuthCode('');
  }

  function applyAdminResources(
    companies: AdminCompany[],
    nextAdminGames: AdminGame[],
  ) {
    setAdminCompanies(companies);
    setAdminGames(nextAdminGames);
    setBalanceCompanyId((current) =>
      getDefaultAdminCompanyId(companies, current),
    );
    setNewGameCompanyId((current) =>
      getDefaultAdminCompanyId(companies, current),
    );
    setBudgetGameId((current) => getDefaultAdminGameId(nextAdminGames, current));
  }

  async function loadAdminResourcesForToken(
    token: string,
    isCurrent = () => true,
  ) {
    try {
      const [companyResult, gameResult] = await Promise.all([
        aiKsApi.getAdminCompanies(token),
        aiKsApi.getAdminGames(token),
      ]);
      if (!isCurrent()) {
        return false;
      }

      applyAdminResources(companyResult.companies, gameResult.games);
      return true;
    } catch (nextError) {
      if (!isCurrent()) {
        return false;
      }

      if (nextError instanceof ApiError && nextError.status === 401) {
        handleUnauthorized('admin');
        setError(nextError.message);
        return false;
      }

      setError(
        nextError instanceof Error ? nextError.message : '请求失败，请检查 API',
      );
      return false;
    }
  }

  async function loadAdminResources() {
    if (!adminAccessToken) {
      setError('请先登录管理员账号');
      return;
    }

    await runAction('admin-resources', async (isCurrent) => {
      const loaded = await loadAdminResourcesForToken(adminAccessToken, isCurrent);
      if (!isCurrent() || !loaded) {
        return;
      }

      setNotice('预算资源已刷新');
    }, 'admin');
  }

  function applyKuaishouTokenStatus(nextStatus: KuaishouTokenStatusResult) {
    setKuaishouTokenStatus(nextStatus);
    setKuaishouAppId((current) =>
      getDefaultKuaishouAppId(nextStatus, current),
    );
  }

  async function loadKuaishouTokenStatusForToken(
    token: string,
    isCurrent = () => true,
  ) {
    try {
      const result = await aiKsApi.getKuaishouTokenStatus(token);
      if (!isCurrent()) {
        return false;
      }

      applyKuaishouTokenStatus(result);
      return true;
    } catch (nextError) {
      if (!isCurrent()) {
        return false;
      }

      if (nextError instanceof ApiError && nextError.status === 401) {
        handleUnauthorized('admin');
        setError(nextError.message);
        return false;
      }

      setError(
        nextError instanceof Error ? nextError.message : '请求失败，请检查 API',
      );
      return false;
    }
  }

  async function loadKuaishouTokenStatus() {
    if (!adminAccessToken) {
      setError('请先登录管理员账号');
      return;
    }

    await runAction('kuaishou-token', async (isCurrent) => {
      const loaded = await loadKuaishouTokenStatusForToken(
        adminAccessToken,
        isCurrent,
      );
      if (!isCurrent() || !loaded) {
        return;
      }

      setNotice('平台授权状态已刷新');
    }, 'admin');
  }

  async function loadKuaishouEcpmJobsForToken(
    token: string,
    isCurrent = () => true,
  ) {
    try {
      const result = await aiKsApi.getKuaishouEcpmJobs(token, 20);
      if (!isCurrent()) {
        return false;
      }

      setKuaishouEcpmJobs(result.jobs);
      return true;
    } catch (nextError) {
      if (!isCurrent()) {
        return false;
      }

      if (nextError instanceof ApiError && nextError.status === 401) {
        handleUnauthorized('admin');
        setError(nextError.message);
        return false;
      }

      setError(
        nextError instanceof Error ? nextError.message : '请求失败，请检查 API',
      );
      return false;
    }
  }

  async function loadKuaishouEcpmJobs() {
    if (!adminAccessToken) {
      setError('请先登录管理员账号');
      return;
    }

    await runAction('kuaishou-ecpm-jobs', async (isCurrent) => {
      const loaded = await loadKuaishouEcpmJobsForToken(
        adminAccessToken,
        isCurrent,
      );
      if (!isCurrent() || !loaded) {
        return;
      }

      setNotice('同步任务已刷新');
    }, 'admin');
  }

  async function authorizeKuaishouToken() {
    if (!adminAccessToken) {
      setError('请先登录管理员账号');
      return;
    }

    const appId = kuaishouAppId.trim();
    const secret = kuaishouSecret.trim();
    const authCode = kuaishouAuthCode.trim();
    if (!appId || !secret || !authCode) {
      setError('请填写平台 app_id、secret 和 auth_code');
      return;
    }

    await runAction('kuaishou-authorize', async (isCurrent) => {
      const result = await aiKsApi.authorizeKuaishouToken(adminAccessToken, {
        appId,
        authCode,
        secret,
      });
      if (!isCurrent()) {
        return;
      }

      applyKuaishouTokenStatus(result);
      setKuaishouSecret('');
      setKuaishouAuthCode('');
      setNotice('平台授权已更新');
    }, 'admin');
  }

  async function refreshKuaishouToken() {
    if (!adminAccessToken) {
      setError('请先登录管理员账号');
      return;
    }

    await runAction('kuaishou-refresh-token', async (isCurrent) => {
      const result = await aiKsApi.refreshKuaishouToken(adminAccessToken);
      if (!isCurrent()) {
        return;
      }

      applyKuaishouTokenStatus(result);
      setNotice('平台 token 已刷新');
    }, 'admin');
  }

  async function reloadDemoContext(isCurrent = () => true) {
    const context = await aiKsApi.getDemoContext();
    if (!isCurrent()) {
      return;
    }

    setGames(context.games);
    setSampleJsCodes(context.sampleJsCodes);
    setGameAppId((current) => current || context.games[0]?.gameAppId || '');
  }

  async function createAdminCompany() {
    if (!adminAccessToken) {
      setError('请先登录管理员账号');
      return;
    }

    const name = newCompanyName.trim();
    if (!name) {
      setError('请输入公司名称');
      return;
    }

    await runAction('company-create', async (isCurrent) => {
      await aiKsApi.createAdminCompany(adminAccessToken, { name });
      if (!isCurrent()) {
        return;
      }

      setNewCompanyName('');
      await loadAdminResourcesForToken(adminAccessToken, isCurrent);
      if (!isCurrent()) {
        return;
      }

      setNotice('公司已创建');
    }, 'admin');
  }

  async function adjustCompanyBalance() {
    if (!adminAccessToken) {
      setError('请先登录管理员账号');
      return;
    }

    if (!balanceCompanyId || !balanceAmountYuan.trim()) {
      setError('请选择公司并填写充值金额');
      return;
    }

    await runAction('company-balance', async (isCurrent) => {
      await aiKsApi.adjustCompanyBalance(adminAccessToken, balanceCompanyId, {
        amountYuan: balanceAmountYuan,
        reason: balanceReason,
      });
      if (!isCurrent()) {
        return;
      }

      setBalanceAmountYuan('');
      await loadAdminResourcesForToken(adminAccessToken, isCurrent);
      if (!isCurrent()) {
        return;
      }

      setNotice('公司余额已更新');
    }, 'admin');
  }

  async function createAdminGame() {
    if (!adminAccessToken) {
      setError('请先登录管理员账号');
      return;
    }

    const companyId = newGameCompanyId.trim();
    const name = newGameName.trim();
    const nextGameAppId = newGameAppId.trim();
    const gameSecret = newGameSecret.trim();
    if (!companyId || !name || !nextGameAppId || !gameSecret) {
      setError('请填写公司、游戏名称、AppID 和密钥');
      return;
    }

    await runAction('game-create', async (isCurrent) => {
      await aiKsApi.createAdminGame(adminAccessToken, {
        companyId,
        gameAppId: nextGameAppId,
        gameSecret,
        name,
      });
      if (!isCurrent()) {
        return;
      }

      setNewGameName('');
      setNewGameAppId('');
      setNewGameSecret('');
      await Promise.all([
        loadAdminResourcesForToken(adminAccessToken, isCurrent),
        reloadDemoContext(isCurrent),
      ]);
      if (!isCurrent()) {
        return;
      }

      setNotice('游戏已创建');
    }, 'admin');
  }

  async function allocateGameBudget() {
    if (!adminAccessToken) {
      setError('请先登录管理员账号');
      return;
    }

    if (!budgetGameId || !budgetAmountYuan.trim()) {
      setError('请选择游戏并填写分配金额');
      return;
    }

    await runAction('game-budget', async (isCurrent) => {
      await aiKsApi.allocateGameBudget(adminAccessToken, budgetGameId, {
        amountYuan: budgetAmountYuan,
        reason: budgetReason,
      });
      if (!isCurrent()) {
        return;
      }

      setBudgetAmountYuan('');
      await loadAdminResourcesForToken(adminAccessToken, isCurrent);
      if (!isCurrent()) {
        return;
      }

      const settlementGameId = getSettlementGameId();
      if (settlementGameId) {
        await loadSettlementBatchesForGame(
          adminAccessToken,
          settlementGameId,
          isCurrent,
        );
      }
      if (!isCurrent()) {
        return;
      }

      setNotice('游戏预算已分配');
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

  function currentSettlementRangeState(): SettlementRangeState {
    return {
      gameAppId,
      settlementEndDate,
      settlementPreview,
      settlementStartDate,
      settlementUserId,
    };
  }

  function applySettlementRangeChange(
    patch: Partial<Omit<SettlementRangeState, 'settlementPreview'>>,
  ) {
    const next = changeSettlementRange(currentSettlementRangeState(), patch);

    setGameAppId(next.gameAppId);
    setSettlementStartDate(next.settlementStartDate);
    setSettlementEndDate(next.settlementEndDate);
    setSettlementUserId(next.settlementUserId);
    setSettlementPreview(next.settlementPreview);
  }

  function changeGameAppId(value: string) {
    nextSettlementBatchRequestVersion();
    applySettlementRangeChange({ gameAppId: value });
    setSettlementBatches([]);
  }

  function changeSettlementStartDate(value: string) {
    applySettlementRangeChange({ settlementStartDate: value });
  }

  function changeSettlementEndDate(value: string) {
    applySettlementRangeChange({ settlementEndDate: value });
  }

  function changeSettlementUserId(value: string) {
    applySettlementRangeChange({ settlementUserId: value });
  }

  function getSettlementRange(): AdminSettlementRange {
    return buildSettlementRange({
      endDate: settlementEndDate,
      gameId: selectedGame?.id ?? '',
      startDate: settlementStartDate,
      userId: settlementUserId,
    });
  }

  function getSettlementGameId(targetGameAppId = gameAppId) {
    return getSettlementGameRowId(games, targetGameAppId);
  }

  function canConfirmSettlement() {
    return Boolean(
      settlementPreview?.canConfirm && settlementPreview.settlementCount > 0,
    );
  }

  async function loadSettlementBatches(
    token: string,
    targetGameId: string,
    isCurrent = () => true,
  ) {
    if (!targetGameId) {
      setSettlementBatches([]);
      return;
    }

    const result = await aiKsApi.getSettlementBatches(token, targetGameId);
    if (!isCurrent()) {
      return;
    }

    setSettlementBatches(result.batches);
  }

  function nextSettlementBatchRequestVersion() {
    settlementBatchRequestVersionRef.current += 1;
    return settlementBatchRequestVersionRef.current;
  }

  async function loadSettlementBatchesForGame(
    token: string,
    targetGameId: string,
    isCurrentSession = () => true,
  ) {
    const requestVersion = nextSettlementBatchRequestVersion();
    const canApply = () =>
      shouldApplySettlementBatchResponse(
        requestVersion,
        settlementBatchRequestVersionRef.current,
        isCurrentSession(),
      );

    try {
      await loadSettlementBatches(token, targetGameId, canApply);
      return canApply();
    } catch (nextError) {
      if (!canApply()) {
        return false;
      }

      if (nextError instanceof ApiError && nextError.status === 401) {
        handleUnauthorized('admin');
        setError(nextError.message);
        return false;
      }

      setError(
        nextError instanceof Error ? nextError.message : '请求失败，请检查 API',
      );
      return false;
    }
  }

  async function previewSettlement() {
    if (!adminAccessToken) {
      setError('请先登录管理员账号');
      return;
    }

    if (!getSettlementGameId()) {
      setError('请选择要结算的游戏');
      return;
    }

    await runAction('settlement-preview', async (isCurrent) => {
      const range = getSettlementRange();
      const batchRequestVersion = nextSettlementBatchRequestVersion();
      const [result, batchResult] = await Promise.all([
        aiKsApi.previewSettlement(adminAccessToken, range),
        aiKsApi.getSettlementBatches(adminAccessToken, range.gameId),
      ]);
      if (!isCurrent()) {
        return;
      }

      setSettlementPreview(result);
      if (
        shouldApplySettlementBatchResponse(
          batchRequestVersion,
          settlementBatchRequestVersionRef.current,
          isCurrent(),
        )
      ) {
        setSettlementBatches(batchResult.batches);
      }
      setNotice(`待结算 ${result.settlementCount} 条`);
    }, 'admin');
  }

  async function confirmSettlement() {
    if (!adminAccessToken) {
      setError('请先登录管理员账号');
      return;
    }

    if (!getSettlementGameId()) {
      setError('请选择要结算的游戏');
      return;
    }

    if (!canConfirmSettlement()) {
      setError('请先预览可结算收益');
      return;
    }

    await runAction('settlement-confirm', async (isCurrent) => {
      const range = getSettlementRange();
      const result = await aiKsApi.confirmSettlement(
        adminAccessToken,
        range,
      );
      if (!isCurrent()) {
        return;
      }

      setSettlementPreview(undefined);
      setSettlementBatches((current) => [result.batch, ...current].slice(0, 20));
      const batchesLoaded = await loadSettlementBatchesForGame(
        adminAccessToken,
        range.gameId,
        isCurrent,
      );
      if (!isCurrent() || !batchesLoaded) {
        return;
      }

      setNotice(`结算成功，入账 ${result.batch.settledCount} 条`);
    }, 'admin');
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
          onQueryAccountEarnings={queryAccountEarnings}
          onRequestWithdrawal={requestWithdrawal}
          onUpdateAlipayProfile={updateAlipayProfile}
          onWithdrawalAmountChange={setWithdrawalAmountYuan}
          withdrawal={withdrawal}
          withdrawalAmountYuan={withdrawalAmountYuan}
        />
      ) : null}
      {activeView === 'operations' && appSession.mode === 'admin' ? (
        <OperationsWorkspace
          adminCompanies={adminCompanies}
          adminGames={adminGames}
          adminName={adminName}
          adminWithdrawalStatus={adminWithdrawalStatus}
          adminWithdrawals={adminWithdrawals}
          auditLogs={auditLogs}
          balanceAmountYuan={balanceAmountYuan}
          balanceCompanyId={balanceCompanyId}
          balanceReason={balanceReason}
          budgetAmountYuan={budgetAmountYuan}
          budgetGameId={budgetGameId}
          budgetReason={budgetReason}
          busyAction={operationsBusyAction(busyAction)}
          gameAppId={gameAppId}
          games={games}
          jsCode={jsCode}
          kuaishouAppId={kuaishouAppId}
          kuaishouAuthCode={kuaishouAuthCode}
          kuaishouEcpmJobs={kuaishouEcpmJobs}
          kuaishouSecret={kuaishouSecret}
          kuaishouTokenStatus={kuaishouTokenStatus}
          newCompanyName={newCompanyName}
          newGameAppId={newGameAppId}
          newGameCompanyId={newGameCompanyId}
          newGameName={newGameName}
          newGameSecret={newGameSecret}
          onAdjustCompanyBalance={adjustCompanyBalance}
          onAllocateGameBudget={allocateGameBudget}
          onApproveWithdrawal={approveAdminWithdrawal}
          onBalanceAmountChange={setBalanceAmountYuan}
          onBalanceCompanyIdChange={setBalanceCompanyId}
          onBalanceReasonChange={setBalanceReason}
          onBudgetAmountChange={setBudgetAmountYuan}
          onBudgetGameIdChange={setBudgetGameId}
          onBudgetReasonChange={setBudgetReason}
          onCloseWithdrawal={closeAdminWithdrawal}
          onConfirmSettlement={confirmSettlement}
          onCreateCompany={createAdminCompany}
          onCreateGame={createAdminGame}
          onCreateSession={createGameSession}
          onGameChange={changeGameAppId}
          onJsCodeChange={setJsCode}
          onKuaishouAppIdChange={setKuaishouAppId}
          onKuaishouAuthCodeChange={setKuaishouAuthCode}
          onKuaishouAuthorize={authorizeKuaishouToken}
          onKuaishouRefreshToken={refreshKuaishouToken}
          onKuaishouSecretChange={setKuaishouSecret}
          onLoadKuaishouEcpmJobs={loadKuaishouEcpmJobs}
          onLoadKuaishouTokenStatus={loadKuaishouTokenStatus}
          onLoadAdminResources={loadAdminResources}
          onLoadAuditLogs={loadAuditLogs}
          onLoadWithdrawalDetail={loadWithdrawalDetail}
          onLoadWithdrawals={loadAdminWithdrawals}
          onNewCompanyNameChange={setNewCompanyName}
          onNewGameAppIdChange={setNewGameAppId}
          onNewGameCompanyIdChange={setNewGameCompanyId}
          onNewGameNameChange={setNewGameName}
          onNewGameSecretChange={setNewGameSecret}
          onPayWithdrawal={payAdminWithdrawal}
          onPreviewSettlement={previewSettlement}
          onRefreshEcpm={refreshEcpm}
          onSettlementEndDateChange={changeSettlementEndDate}
          onSettlementStartDateChange={changeSettlementStartDate}
          onSettlementUserIdChange={changeSettlementUserId}
          refreshResult={refreshResult}
          sampleJsCodes={sampleJsCodes}
          selectedGame={selectedGame}
          selectedWithdrawalDetail={selectedWithdrawalDetail}
          settlementBatches={settlementBatches}
          settlementEndDate={settlementEndDate}
          settlementPreview={settlementPreview}
          settlementStartDate={settlementStartDate}
          settlementUserId={settlementUserId}
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
    case 'admin-resources':
    case 'audit-logs':
    case 'company-balance':
    case 'company-create':
    case 'game-budget':
    case 'game-create':
    case 'kuaishou-authorize':
    case 'kuaishou-ecpm-jobs':
    case 'kuaishou-refresh-token':
    case 'kuaishou-token':
    case 'refresh':
    case 'settlement-confirm':
    case 'settlement-preview':
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
