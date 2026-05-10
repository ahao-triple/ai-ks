import { useEffect, useMemo, useRef, useState } from 'react';
import {
  createGuestSession,
  createSignedOutSession,
  type AppSession,
  type ViewKey,
} from './app/session';
import {
  createOperationFeedbackItem,
  finishOperationFeedbackItem,
  limitOperationFeedbackItems,
  type OperationFeedbackItem,
  type OperationFeedbackStatus,
} from './app/operationFeedback';
import { Alert, OperationFeedback } from './components/ui';
import { DashboardLayout } from './layouts/DashboardLayout';
import { ApiError } from './lib/api';
import { aiKsApi } from './lib/aiKsApi';
import { buildOperationsOverview } from './lib/operationsOverview';
import {
  ACCOUNT_AUTH_STORAGE_KEY,
  ADMIN_AUTH_STORAGE_KEY,
  AGENT_AUTH_STORAGE_KEY,
  clearStoredToken,
  readStoredToken,
  writeStoredToken,
} from './lib/auth';
import {
  AccountWorkspace,
  type AccountWorkspaceBusyAction,
} from './pages/AccountWorkspace';
import {
  AgentWorkspace,
  type AgentWorkspaceBusyAction,
} from './pages/AgentWorkspace';
import { GuestQueryPage } from './pages/GuestQueryPage';
import {
  LoginPage,
  type LoginBusyAction,
  type LoginMode,
} from './pages/LoginPage';
import {
  OperationsWorkspace,
  type PlatformConfigDraft,
  type OperationsWorkspaceBusyAction,
} from './pages/OperationsWorkspace';
import type {
  AccountEarningsResult,
  AccountAgentBindingResult,
  AccountResult,
  AdminCompany,
  AdminCompanyAdmin,
  AdminGame,
  AdminPrincipal,
  AdminSettlementBatch,
  AdminSettlementDetailResult,
  AdminSettlementPreview,
  AdminSettlementRange,
  AdminWithdrawalBatch,
  AdminWithdrawalDetailResult,
  AdminAgent,
  AgentEarningsResult,
  AgentPrincipal,
  AgentProfile,
  AgentUsersResult,
  AuditLogRow,
  BusinessClosureReport,
  DemoGame,
  EarningsResult,
  EcpmDashboardRow,
  EcpmDashboardScope,
  EcpmLookbackHours,
  EcpmRefreshResult,
  EcpmUpdateJob,
  EcpmUpdateRequest,
  GameSessionResult,
  IntegrationStatus,
  KuaishouEcpmSyncJob,
  KuaishouTokenStatusResult,
  PlatformConfig,
  PlatformConfigUpdateInput,
  WithdrawalResult,
} from './types/api';

type AppBusyAction =
  | LoginBusyAction
  | AccountWorkspaceBusyAction
  | AgentWorkspaceBusyAction
  | OperationsWorkspaceBusyAction
  | 'query';

type AuthScope = 'account' | 'admin' | 'agent' | 'none';

type LoadOptions = {
  reportError?: boolean;
};

type SettlementRangeState = {
  gameAppId: string;
  settlementEndDate: string;
  settlementPreview?: AdminSettlementPreview;
  settlementStartDate: string;
  settlementUserId: string;
};

type GameConfigSection = 'audit' | 'basic' | 'budget' | 'ecpm';

type GameConfigDraft = {
  ecpmAutoSyncEnabled: boolean;
  ecpmAutoSyncIntervalHours: EcpmLookbackHours;
  gameSecret: string;
  name: string;
  settlementPaused: boolean;
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

export function readKuaishouOAuthCallback(search: string) {
  const params = new URLSearchParams(
    search.startsWith('?') ? search.slice(1) : search,
  );
  const authCode =
    params.get('auth_code')?.trim() || params.get('code')?.trim() || '';
  if (!authCode) {
    return undefined;
  }

  return {
    appId: params.get('app_id')?.trim() || params.get('appId')?.trim() || '',
    authCode,
  };
}

function buildGameConfigDraft(game: AdminGame): GameConfigDraft {
  return {
    ecpmAutoSyncEnabled: game.ecpmAutoSyncEnabled,
    ecpmAutoSyncIntervalHours: game.ecpmAutoSyncIntervalHours,
    gameSecret: game.gameSecret,
    name: game.name,
    settlementPaused: game.settlementPaused,
  };
}

function defaultPlatformConfig(): PlatformConfig {
  return {
    defaultAgentId: null,
    defaultAgentRatioPercent: 0,
    directAgentRatioPercent: 0,
    displayRatioPercent: 50,
    feeRatioPercent: 0,
    minWithdrawal: { li: '10000', yuan: '10.00' },
    parentAgentRatioPercent: 0,
    userSettlementRatioPercent: 100,
  };
}

function buildPlatformConfigDraft(config: PlatformConfig): PlatformConfigDraft {
  return {
    defaultAgentId: config.defaultAgentId ?? '',
    defaultAgentRatioPercent: String(config.defaultAgentRatioPercent),
    directAgentRatioPercent: String(config.directAgentRatioPercent),
    displayRatioPercent: String(config.displayRatioPercent),
    feeRatioPercent: String(config.feeRatioPercent),
    minWithdrawalYuan: config.minWithdrawal.yuan,
    parentAgentRatioPercent: String(config.parentAgentRatioPercent),
    userSettlementRatioPercent: String(config.userSettlementRatioPercent),
  };
}

export function shouldApplySettlementBatchResponse(
  requestVersion: number,
  currentVersion: number,
  isCurrentSession: boolean,
) {
  return isCurrentSession && requestVersion === currentVersion;
}

export function getAdminDisplayName(admin: AdminPrincipal) {
  return admin.role === 'COMPANY_ADMIN' ? admin.displayName : admin.username;
}

export function isSuperAdmin(admin?: AdminPrincipal) {
  return admin?.role === 'SUPER_ADMIN';
}

export function mergeEcpmUpdateJob(
  currentJob: EcpmUpdateJob | undefined,
  nextJob: EcpmUpdateJob,
): EcpmUpdateJob {
  return {
    ...currentJob,
    ...nextJob,
    items: nextJob.items ?? currentJob?.items,
  };
}

export function upsertEcpmUpdateJobList(
  current: EcpmUpdateJob[],
  nextJob: EcpmUpdateJob,
) {
  const existingIndex = current.findIndex((job) => job.id === nextJob.id);
  if (existingIndex < 0) {
    return [nextJob, ...current].slice(0, 20);
  }

  const merged = [...current];
  merged[existingIndex] = mergeEcpmUpdateJob(merged[existingIndex], nextJob);
  return merged;
}

export function reconcileSelectedEcpmUpdateJob(
  selectedJob: EcpmUpdateJob | undefined,
  refreshedJobs: EcpmUpdateJob[],
) {
  if (!selectedJob) {
    return undefined;
  }

  const refreshedJob = refreshedJobs.find((job) => job.id === selectedJob.id);
  return refreshedJob
    ? mergeEcpmUpdateJob(selectedJob, refreshedJob)
    : undefined;
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
  const [configKuaishouEcpmJobs, setConfigKuaishouEcpmJobs] = useState<
    KuaishouEcpmSyncJob[]
  >([]);
  const [kuaishouAppId, setKuaishouAppId] = useState('');
  const [kuaishouSecret, setKuaishouSecret] = useState('');
  const [kuaishouAuthCode, setKuaishouAuthCode] = useState('');
  const [gameAppId, setGameAppId] = useState('');
  const [jsCode, setJsCode] = useState('');
  const [gameSession, setGameSession] = useState<GameSessionResult>();
  const [refreshResult, setRefreshResult] = useState<EcpmRefreshResult>();
  const [ecpmDashboardRows, setEcpmDashboardRows] = useState<
    EcpmDashboardRow[]
  >([]);
  const [ecpmUpdateJobs, setEcpmUpdateJobs] = useState<EcpmUpdateJob[]>([]);
  const [selectedEcpmUpdateJob, setSelectedEcpmUpdateJob] =
    useState<EcpmUpdateJob>();
  const [identity, setIdentity] = useState('');
  const [bindIdentity, setBindIdentity] = useState('');
  const [earnings, setEarnings] = useState<EarningsResult>();
  const [username, setUsername] = useState('demo_user');
  const [password, setPassword] = useState('demo123456');
  const [invitationCode, setInvitationCode] = useState('');
  const [account, setAccount] = useState<AccountResult>();
  const [accountAgentBinding, setAccountAgentBinding] =
    useState<AccountAgentBindingResult>();
  const [accountAgentInvitationCode, setAccountAgentInvitationCode] =
    useState('');
  const [accessToken, setAccessToken] = useState(() =>
    readStoredToken(ACCOUNT_AUTH_STORAGE_KEY),
  );
  const [adminAccessToken, setAdminAccessToken] = useState(() =>
    readStoredToken(ADMIN_AUTH_STORAGE_KEY),
  );
  const [agentAccessToken, setAgentAccessToken] = useState(() =>
    readStoredToken(AGENT_AUTH_STORAGE_KEY),
  );
  const [adminUsername, setAdminUsername] = useState('admin');
  const [adminPassword, setAdminPassword] = useState('admin123456');
  const [agentUsername, setAgentUsername] = useState('demo_default_agent');
  const [agentPassword, setAgentPassword] = useState('demo-agent-pass');
  const [currentAgent, setCurrentAgent] = useState<AgentPrincipal>();
  const [agentProfile, setAgentProfile] = useState<AgentProfile>();
  const [agentEarnings, setAgentEarnings] = useState<AgentEarningsResult>();
  const [agentUsers, setAgentUsers] = useState<AgentUsersResult>();
  const [agentWithdrawals, setAgentWithdrawals] = useState<
    AdminWithdrawalBatch[]
  >([]);
  const [ownAgentAlipayAccount, setOwnAgentAlipayAccount] = useState('');
  const [ownAgentAlipayRealName, setOwnAgentAlipayRealName] = useState('');
  const [ownAgentWithdrawalAmountYuan, setOwnAgentWithdrawalAmountYuan] =
    useState('10.00');
  const [currentAdmin, setCurrentAdmin] = useState<AdminPrincipal>();
  const [adminName, setAdminName] = useState('');
  const [adminCompanies, setAdminCompanies] = useState<AdminCompany[]>([]);
  const [adminAgents, setAdminAgents] = useState<AdminAgent[]>([]);
  const [companyAdmins, setCompanyAdmins] = useState<AdminCompanyAdmin[]>([]);
  const [adminGames, setAdminGames] = useState<AdminGame[]>([]);
  const [businessClosure, setBusinessClosure] =
    useState<BusinessClosureReport>();
  const [platformConfig, setPlatformConfig] = useState<PlatformConfig>(() =>
    defaultPlatformConfig(),
  );
  const [platformConfigDraft, setPlatformConfigDraft] =
    useState<PlatformConfigDraft>(() =>
      buildPlatformConfigDraft(defaultPlatformConfig()),
    );
  const [newCompanyName, setNewCompanyName] = useState('');
  const [balanceCompanyId, setBalanceCompanyId] = useState('');
  const [balanceAmountYuan, setBalanceAmountYuan] = useState('');
  const [balanceReason, setBalanceReason] = useState('');
  const [newGameCompanyId, setNewGameCompanyId] = useState('');
  const [newGameName, setNewGameName] = useState('');
  const [newGameAppId, setNewGameAppId] = useState('');
  const [newGameSecret, setNewGameSecret] = useState('');
  const [newAgentUsername, setNewAgentUsername] = useState('');
  const [newAgentPassword, setNewAgentPassword] = useState('');
  const [newAgentInvitationCode, setNewAgentInvitationCode] = useState('');
  const [newAgentParentId, setNewAgentParentId] = useState('');
  const [agentActionAgentId, setAgentActionAgentId] = useState('');
  const [agentAlipayAccount, setAgentAlipayAccount] = useState('');
  const [agentAlipayRealName, setAgentAlipayRealName] = useState('');
  const [agentWithdrawalAmountYuan, setAgentWithdrawalAmountYuan] = useState('');
  const [budgetGameId, setBudgetGameId] = useState('');
  const [budgetAmountYuan, setBudgetAmountYuan] = useState('');
  const [budgetReason, setBudgetReason] = useState('');
  const [selectedConfigGameId, setSelectedConfigGameId] = useState('');
  const [configSection, setConfigSection] =
    useState<GameConfigSection>('basic');
  const [configGameDraft, setConfigGameDraft] = useState<GameConfigDraft>();
  const [configBudgetAmountYuan, setConfigBudgetAmountYuan] = useState('');
  const [configBudgetReason, setConfigBudgetReason] = useState('');
  const [configEcpmLookbackHours, setConfigEcpmLookbackHours] =
    useState<EcpmLookbackHours>(3);
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
  const [selectedSettlementDetail, setSelectedSettlementDetail] =
    useState<AdminSettlementDetailResult>();
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [operationFeedbackItems, setOperationFeedbackItems] = useState<
    OperationFeedbackItem[]
  >([]);
  const [busyAction, setBusyAction] = useState<AppBusyAction>('');
  const busyRef = useRef(false);
  const operationFeedbackIdRef = useRef(0);
  const sessionVersionRef = useRef(0);
  const settlementBatchRequestVersionRef = useRef(0);
  const configEcpmJobsRequestVersionRef = useRef(0);
  const selectedConfigGameIdRef = useRef('');

  const selectedGame = useMemo(
    () => games.find((game) => game.gameAppId === gameAppId),
    [gameAppId, games],
  );
  const selectedConfigGame = useMemo(
    () => adminGames.find((game) => game.id === selectedConfigGameId),
    [adminGames, selectedConfigGameId],
  );
  const operationsOverview = useMemo(
    () =>
      buildOperationsOverview({
        adminGames,
        configKuaishouEcpmJobs,
        kuaishouEcpmJobs,
        settlementBatches,
        settlementPreview,
      }),
    [
      adminGames,
      configKuaishouEcpmJobs,
      kuaishouEcpmJobs,
      settlementBatches,
      settlementPreview,
    ],
  );
  const modeText =
    status?.kuaishouApiMode === 'mock'
      ? '快手 Mock'
      : status?.kuaishouApiMode === 'real'
        ? '快手 Real'
        : '接口状态未知';

  useEffect(() => {
    applyKuaishouOAuthCallbackFromLocation();
    void initializeApp();
  }, []);

  useEffect(() => {
    if (appSession.mode !== 'admin' || !adminAccessToken || !currentAdmin) {
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
  }, [adminAccessToken, appSession.mode, currentAdmin, gameAppId, games]);

  useEffect(() => {
    if (!selectedConfigGameId) {
      return;
    }

    const game = adminGames.find((row) => row.id === selectedConfigGameId);
    if (!game) {
      closeGameConfig();
    }
  }, [adminGames, selectedConfigGameId]);

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

  function startOperationFeedback(actionName: AppBusyAction) {
    operationFeedbackIdRef.current += 1;
    const feedbackId = `operation-${operationFeedbackIdRef.current}`;
    setOperationFeedbackItems((current) =>
      limitOperationFeedbackItems([
        createOperationFeedbackItem(actionName, feedbackId),
        ...current,
      ]),
    );

    return feedbackId;
  }

  function finishOperationFeedback(
    feedbackId: string,
    status: Exclude<OperationFeedbackStatus, 'running'>,
    message?: string,
  ) {
    setOperationFeedbackItems((current) =>
      finishOperationFeedbackItem(current, feedbackId, status, message),
    );
  }

  function getActionErrorMessage(nextError: unknown) {
    if (nextError instanceof Error) {
      return nextError.message;
    }

    return '请求失败，请检查 API';
  }

  function reportActionError(actionName: AppBusyAction, message: string) {
    setError(message);
    setNotice('');
    const feedbackId = startOperationFeedback(actionName);
    finishOperationFeedback(feedbackId, 'failed', message);
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
          await Promise.all([
            loadAlipayProfile(accessToken, () =>
              isCurrentSessionVersion(restoreVersion),
            ),
            loadAccountAgentBinding(accessToken, () =>
              isCurrentSessionVersion(restoreVersion),
            ),
          ]);
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

        await restoreAdminSession(adminAccessToken, () =>
          isCurrentSessionVersion(restoreVersion),
        );
      }

      if (!accessToken && !adminAccessToken && agentAccessToken) {
        if (!isCurrentSessionVersion(restoreVersion)) {
          return;
        }

        await restoreAgentSession(agentAccessToken, () =>
          isCurrentSessionVersion(restoreVersion),
        );
      }
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : '无法连接 API，请确认后端服务已启动',
      );
    }
  }

  async function restoreAdminSession(token: string, isCurrent = () => true) {
    try {
      const result = await aiKsApi.getCurrentAdmin(token);
      if (!isCurrent()) {
        return;
      }

      setCurrentAdmin(result.admin);
      setAdminName(getAdminDisplayName(result.admin));
      setAppSession({
        accessToken: token,
        admin: result.admin,
        mode: 'admin',
      });
      setActiveView('operations');
      await loadAdminResourcesForToken(token, isCurrent, result.admin);
    } catch (nextError) {
      if (!isCurrent()) {
        return;
      }

      if (nextError instanceof ApiError && nextError.status === 401) {
        clearAdminAuth();
      } else {
        setError(
          nextError instanceof Error ? nextError.message : '请求失败，请检查 API',
        );
      }
    }
  }

  async function restoreAgentSession(token: string, isCurrent = () => true) {
    try {
      const profile = await aiKsApi.getCurrentAgent(token);
      if (!isCurrent()) {
        return;
      }

      applyAgentProfile(profile);
      setAppSession({
        accessToken: token,
        agent: pickAgentPrincipal(profile),
        mode: 'agent',
      });
      setActiveView('agent');
      await loadAgentPortalForToken(token, isCurrent);
    } catch (nextError) {
      if (!isCurrent()) {
        return;
      }

      if (nextError instanceof ApiError && nextError.status === 401) {
        clearAgentAuth();
      } else {
        setError(
          nextError instanceof Error ? nextError.message : '请求失败，请检查 API',
        );
      }
    }
  }

  async function runAction(
    name: AppBusyAction,
    action: (isCurrent: () => boolean) => Promise<false | void>,
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
    const feedbackId = startOperationFeedback(name);

    try {
      const actionResult = await action(() =>
        isCurrentSessionVersion(actionVersion),
      );
      if (!isCurrentSessionVersion(actionVersion)) {
        finishOperationFeedback(
          feedbackId,
          'failed',
          '操作已取消，当前登录状态已变化',
        );
        return;
      }

      if (actionResult === false) {
        finishOperationFeedback(
          feedbackId,
          'failed',
          '操作未完成，请查看错误提示',
        );
        return;
      }

      finishOperationFeedback(feedbackId, 'success');
    } catch (nextError) {
      if (!isCurrentSessionVersion(actionVersion)) {
        finishOperationFeedback(
          feedbackId,
          'failed',
          '操作已取消，当前登录状态已变化',
        );
        return;
      }

      const errorMessage = getActionErrorMessage(nextError);

      if (nextError instanceof ApiError && nextError.status === 401) {
        handleUnauthorized(authScope);
        setError(errorMessage);
      } else {
        setError(errorMessage);
      }
      finishOperationFeedback(feedbackId, 'failed', errorMessage);
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

    if (authScope === 'agent') {
      clearAgentAuth();
    }
  }

  function ensureSuperAdmin(actionName?: AppBusyAction) {
    if (!isSuperAdmin(currentAdmin)) {
      if (actionName) {
        reportActionError(actionName, '无权限访问该操作');
      } else {
        setError('无权限访问该操作');
      }
      return false;
    }

    return true;
  }

  function clearAccountAuth() {
    clearStoredToken(ACCOUNT_AUTH_STORAGE_KEY);
    setAccessToken('');
    setAccount(undefined);
    setAccountAgentBinding(undefined);
    setAccountAgentInvitationCode('');
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
    setCurrentAdmin(undefined);
    setAdminName('');
    clearAdminResourceState();
    clearKuaishouTokenState();
    setKuaishouEcpmJobs([]);
    setAdminWithdrawals([]);
    setAuditLogs([]);
    setSelectedWithdrawalDetail(undefined);
    setSettlementPreview(undefined);
    setSettlementBatches([]);
    setSelectedSettlementDetail(undefined);
    setAppSession(createSignedOutSession());
    setActiveView('query');
  }

  function clearAgentAuth() {
    bumpSessionVersion();
    clearBusyState();
    clearStoredToken(AGENT_AUTH_STORAGE_KEY);
    setAgentAccessToken('');
    setCurrentAgent(undefined);
    setAgentProfile(undefined);
    setAgentEarnings(undefined);
    setAgentUsers(undefined);
    setAgentWithdrawals([]);
    setOwnAgentAlipayAccount('');
    setOwnAgentAlipayRealName('');
    setAppSession(createSignedOutSession());
    setActiveView('query');
  }

  async function queryEarnings() {
    const targetIdentity = identity.trim();
    if (!targetIdentity) {
      reportActionError('query', '请输入 open_id 或可读 ID');
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
      const result = await aiKsApi.registerAccount({
        invitationCode: invitationCode.trim() || null,
        password,
        username,
      });
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
      const adminSessionVersion = sessionVersionRef.current;
      const isCurrentAdminSession = () =>
        isCurrentSessionVersion(adminSessionVersion);
      writeStoredToken(ADMIN_AUTH_STORAGE_KEY, result.accessToken);
      setAdminAccessToken(result.accessToken);
      setCurrentAdmin(result.admin);
      setAdminName(getAdminDisplayName(result.admin));
      setAppSession({
        accessToken: result.accessToken,
        admin: result.admin,
        mode: 'admin',
      });
      setActiveView('operations');
      await loadAdminResourcesForToken(
        result.accessToken,
        isCurrentAdminSession,
        result.admin,
      );
      if (!isCurrentAdminSession()) {
        return;
      }

      setNotice('管理员登录成功');
      clearBusyState();
    }, 'admin');
  }

  async function loginAgent() {
    await runAction('agent-login', async (isCurrent) => {
      const result = await aiKsApi.loginAgent({
        password: agentPassword,
        username: agentUsername,
      });
      if (!isCurrent()) {
        return;
      }

      await persistAgentAuth(
        result.accessToken,
        result.agent,
        '代理登录成功',
      );
    }, 'agent');
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
      await Promise.all([
        loadAlipayProfile(token, isCurrent),
        loadAccountAgentBinding(token, isCurrent),
      ]);
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

  async function persistAgentAuth(
    token: string,
    nextAgent: AgentPrincipal,
    successNotice: string,
  ) {
    bumpSessionVersion();
    const agentVersion = sessionVersionRef.current;
    const isCurrent = () => isCurrentSessionVersion(agentVersion);

    writeStoredToken(AGENT_AUTH_STORAGE_KEY, token);
    setAgentAccessToken(token);
    setCurrentAgent(nextAgent);
    setAppSession({ accessToken: token, agent: nextAgent, mode: 'agent' });
    setActiveView('agent');
    setNotice(successNotice);
    clearBusyState();

    try {
      await loadAgentPortalForToken(token, isCurrent);
    } catch (nextError) {
      if (!isCurrent()) {
        return;
      }

      if (nextError instanceof ApiError && nextError.status === 401) {
        clearAgentAuth();
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
    clearStoredToken(AGENT_AUTH_STORAGE_KEY);
    setAccessToken('');
    setAdminAccessToken('');
    setAgentAccessToken('');
    setCurrentAdmin(undefined);
    setCurrentAgent(undefined);
    setUsername('');
    setPassword('');
    setInvitationCode('');
    setAdminUsername('');
    setAdminPassword('');
    setAgentUsername('');
    setAgentPassword('');
    setAccount(undefined);
    setAccountAgentBinding(undefined);
    setAccountAgentInvitationCode('');
    setAgentProfile(undefined);
    setAgentEarnings(undefined);
    setAgentUsers(undefined);
    setAgentWithdrawals([]);
    setOwnAgentAlipayAccount('');
    setOwnAgentAlipayRealName('');
    setOwnAgentWithdrawalAmountYuan('10.00');
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
    setSelectedSettlementDetail(undefined);
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
      reportActionError('refresh', '请先登录管理员账号');
      return;
    }
    if (!ensureSuperAdmin('refresh')) {
      return;
    }

    await runAction('refresh', async (isCurrent) => {
      const result = await aiKsApi.refreshEcpm(adminAccessToken, gameAppId);
      if (!isCurrent()) {
        return;
      }

      setRefreshResult(result);
      setKuaishouEcpmJobs((current) => [result.job, ...current].slice(0, 20));
      await loadKuaishouEcpmJobsForToken(adminAccessToken, isCurrent, {
        reportError: false,
      });
      if (!isCurrent()) {
        return;
      }

      setNotice(`ECPM 刷新成功，写入 ${result.savedCount} 条明细`);
    }, 'admin');
  }

  async function retryKuaishouEcpmJob(jobId: string) {
    if (!adminAccessToken) {
      reportActionError(`retry-ecpm-${jobId}`, '请先登录管理员账号');
      return;
    }
    if (!ensureSuperAdmin(`retry-ecpm-${jobId}`)) {
      return;
    }

    await runAction(`retry-ecpm-${jobId}`, async (isCurrent) => {
      const result = await aiKsApi.retryKuaishouEcpmJob(
        adminAccessToken,
        jobId,
      );
      if (!isCurrent()) {
        return;
      }

      setRefreshResult(result);
      await loadKuaishouEcpmJobsForToken(adminAccessToken, isCurrent, {
        reportError: false,
      });
      if (!isCurrent()) {
        return;
      }

      const configGame = selectedConfigGame;
      if (configGame && configGame.gameAppId === result.job.gameAppId) {
        await loadConfigKuaishouEcpmJobsForGame(
          adminAccessToken,
          configGame,
          isCurrent,
          {
            reportError: false,
          },
        );
      }
      if (!isCurrent()) {
        return;
      }

      setNotice(`失败任务已重试，写入 ${result.savedCount} 条明细`);
    }, 'admin');
  }

  function clearAdminResourceState() {
    setAdminCompanies([]);
    setAdminAgents([]);
    setCompanyAdmins([]);
    setAdminGames([]);
    setBusinessClosure(undefined);
    setNewCompanyName('');
    setBalanceCompanyId('');
    setBalanceAmountYuan('');
    setBalanceReason('');
    setNewGameCompanyId('');
    setNewGameName('');
    setNewGameAppId('');
    setNewGameSecret('');
    setNewAgentUsername('');
    setNewAgentPassword('');
    setNewAgentInvitationCode('');
    setNewAgentParentId('');
    setAgentActionAgentId('');
    setAgentAlipayAccount('');
    setAgentAlipayRealName('');
    setAgentWithdrawalAmountYuan('');
    setBudgetGameId('');
    setBudgetAmountYuan('');
    setBudgetReason('');
    resetPlatformConfigState();
    clearGameConfigState();
    clearEcpmOperationsState();
  }

  function resetPlatformConfigState() {
    const defaultConfig = defaultPlatformConfig();
    setPlatformConfig(defaultConfig);
    setPlatformConfigDraft(buildPlatformConfigDraft(defaultConfig));
  }

  function clearGameConfigState() {
    selectedConfigGameIdRef.current = '';
    configEcpmJobsRequestVersionRef.current += 1;
    setSelectedConfigGameId('');
    setConfigSection('basic');
    setConfigGameDraft(undefined);
    setConfigBudgetAmountYuan('');
    setConfigBudgetReason('');
    setConfigEcpmLookbackHours(3);
    setConfigKuaishouEcpmJobs([]);
  }

  function clearKuaishouTokenState() {
    setKuaishouTokenStatus(undefined);
    setKuaishouAppId('');
    setKuaishouSecret('');
    setKuaishouAuthCode('');
  }

  function clearEcpmOperationsState() {
    setEcpmDashboardRows([]);
    setEcpmUpdateJobs([]);
    setSelectedEcpmUpdateJob(undefined);
  }

  function applyAdminResources(
    companies: AdminCompany[],
    nextAdminGames: AdminGame[],
  ) {
    setAdminCompanies(companies);
    setAdminGames(nextAdminGames);
    const configGame = nextAdminGames.find(
      (game) => game.id === selectedConfigGameIdRef.current,
    );
    if (configGame) {
      setConfigGameDraft(buildGameConfigDraft(configGame));
    }
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
    admin = currentAdmin,
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
      if (isSuperAdmin(admin)) {
        await Promise.allSettled([
          loadKuaishouTokenStatusForToken(token, isCurrent),
          loadAdminAgentsForToken(token, isCurrent),
          loadBusinessClosureForToken(token, isCurrent),
          loadCompanyAdminsForToken(token, isCurrent),
          loadEcpmUpdateJobsForToken(token, isCurrent, {
            reportError: false,
          }),
          loadPlatformConfigForToken(token, isCurrent),
        ]);
      } else {
        clearKuaishouTokenState();
        setAdminAgents([]);
        setBusinessClosure(undefined);
        setCompanyAdmins([]);
        setEcpmUpdateJobs([]);
        setSelectedEcpmUpdateJob(undefined);
        resetPlatformConfigState();
      }
      const settlementGameId = getAdminEntrySettlementGameRowId(
        games,
        gameAppId,
      );
      await Promise.allSettled([
        loadKuaishouEcpmJobsForToken(token, isCurrent),
        settlementGameId
          ? loadSettlementBatchesForGame(token, settlementGameId, isCurrent)
          : Promise.resolve(false),
        loadAdminWithdrawalsForToken(token, adminWithdrawalStatus, isCurrent),
        loadAuditLogsForToken(token, isCurrent),
      ]);
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

  async function loadCompanyAdminsForToken(
    token: string,
    isCurrent = () => true,
    options: LoadOptions = {},
  ) {
    try {
      const result = await aiKsApi.getCompanyAdmins(token);
      if (!isCurrent()) {
        return false;
      }

      setCompanyAdmins(result.admins);
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

      if (options.reportError ?? true) {
        setError(
          nextError instanceof Error ? nextError.message : '请求失败，请检查 API',
        );
      }
      return false;
    }
  }

  async function loadAdminAgentsForToken(
    token: string,
    isCurrent = () => true,
    options: LoadOptions = {},
  ) {
    try {
      const result = await aiKsApi.getAdminAgents(token);
      if (!isCurrent()) {
        return false;
      }

      setAdminAgents(result.agents);
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

      if (options.reportError ?? true) {
        setError(
          nextError instanceof Error ? nextError.message : '请求失败，请检查 API',
        );
      }
      return false;
    }
  }

  async function loadBusinessClosureForToken(
    token: string,
    isCurrent = () => true,
    options: LoadOptions = {},
  ) {
    try {
      const result = await aiKsApi.getBusinessClosure(token);
      if (!isCurrent()) {
        return false;
      }

      setBusinessClosure(result);
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

      if (options.reportError ?? true) {
        setError(
          nextError instanceof Error ? nextError.message : '请求失败，请检查 API',
        );
      }
      return false;
    }
  }

  async function loadBusinessClosure() {
    if (!adminAccessToken) {
      reportActionError('business-closure', '请先登录管理员账号');
      return;
    }
    if (!ensureSuperAdmin('business-closure')) {
      return;
    }

    await runAction('business-closure', async (isCurrent) => {
      const loaded = await loadBusinessClosureForToken(
        adminAccessToken,
        isCurrent,
      );
      if (!isCurrent()) {
        return;
      }
      if (!loaded) {
        return false;
      }

      setNotice('真实数据闭环核对已刷新');
    }, 'admin');
  }

  async function loadCompanyAdmins() {
    if (!adminAccessToken) {
      reportActionError('company-admins', '请先登录管理员账号');
      return;
    }
    if (!ensureSuperAdmin('company-admins')) {
      return;
    }

    await runAction('company-admins', async (isCurrent) => {
      const loaded = await loadCompanyAdminsForToken(adminAccessToken, isCurrent);
      if (!isCurrent()) {
        return;
      }
      if (!loaded) {
        return false;
      }

      setNotice('公司管理员账号已刷新');
    }, 'admin');
  }

  async function loadAdminAgents() {
    if (!adminAccessToken) {
      reportActionError('agents', '请先登录管理员账号');
      return;
    }
    if (!ensureSuperAdmin('agents')) {
      return;
    }

    await runAction('agents', async (isCurrent) => {
      const loaded = await loadAdminAgentsForToken(adminAccessToken, isCurrent);
      if (!isCurrent()) {
        return;
      }
      if (!loaded) {
        return false;
      }

      setNotice('代理列表已刷新');
    }, 'admin');
  }

  function applyPlatformConfig(nextConfig: PlatformConfig) {
    setPlatformConfig(nextConfig);
    setPlatformConfigDraft(buildPlatformConfigDraft(nextConfig));
  }

  async function loadPlatformConfigForToken(
    token: string,
    isCurrent = () => true,
    options: LoadOptions = {},
  ) {
    try {
      const result = await aiKsApi.getPlatformConfig(token);
      if (!isCurrent()) {
        return false;
      }

      applyPlatformConfig(result);
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

      if (options.reportError ?? true) {
        setError(
          nextError instanceof Error ? nextError.message : '请求失败，请检查 API',
        );
      }
      return false;
    }
  }

  async function loadPlatformConfig() {
    if (!adminAccessToken) {
      reportActionError('platform-config', '请先登录管理员账号');
      return;
    }
    if (!ensureSuperAdmin('platform-config')) {
      return;
    }

    await runAction('platform-config', async (isCurrent) => {
      const loaded = await loadPlatformConfigForToken(
        adminAccessToken,
        isCurrent,
      );
      if (!isCurrent()) {
        return;
      }
      if (!loaded) {
        return false;
      }

      setNotice('平台配置已刷新');
    }, 'admin');
  }

  function changePlatformConfigDraft(patch: Partial<PlatformConfigDraft>) {
    setPlatformConfigDraft((current) => ({
      ...current,
      ...patch,
    }));
  }

  function changeAgentActionAgentId(agentId: string) {
    setAgentActionAgentId(agentId);
    const agent = adminAgents.find((row) => row.id === agentId);
    setAgentAlipayAccount(agent?.alipayAccount ?? '');
    setAgentAlipayRealName(agent?.alipayRealName ?? '');
  }

  function parsePlatformConfigDraft(): PlatformConfigUpdateInput | undefined {
    const defaultAgentRatioPercent = parseIntegerPercent(
      platformConfigDraft.defaultAgentRatioPercent,
    );
    const directAgentRatioPercent = parseIntegerPercent(
      platformConfigDraft.directAgentRatioPercent,
    );
    const displayRatioPercent = parseIntegerPercent(
      platformConfigDraft.displayRatioPercent,
    );
    const feeRatioPercent = parseIntegerPercent(
      platformConfigDraft.feeRatioPercent,
    );
    const parentAgentRatioPercent = parseIntegerPercent(
      platformConfigDraft.parentAgentRatioPercent,
    );
    const userSettlementRatioPercent = parseIntegerPercent(
      platformConfigDraft.userSettlementRatioPercent,
    );
    if (
      defaultAgentRatioPercent === undefined ||
      directAgentRatioPercent === undefined ||
      displayRatioPercent === undefined ||
      feeRatioPercent === undefined ||
      parentAgentRatioPercent === undefined ||
      userSettlementRatioPercent === undefined
    ) {
      reportActionError('platform-config', '比例必须填写 0 到 100 的整数');
      return undefined;
    }
    const settlementTotal =
      userSettlementRatioPercent +
      directAgentRatioPercent +
      parentAgentRatioPercent +
      defaultAgentRatioPercent +
      feeRatioPercent;
    if (settlementTotal !== 100) {
      reportActionError(
        'platform-config',
        `分账比例合计必须为 100%，当前为 ${settlementTotal}%`,
      );
      return undefined;
    }
    const minWithdrawalYuan = platformConfigDraft.minWithdrawalYuan.trim();
    if (!minWithdrawalYuan) {
      reportActionError('platform-config', '请填写最低提现金额');
      return undefined;
    }

    return {
      defaultAgentId: platformConfigDraft.defaultAgentId.trim() || null,
      defaultAgentRatioPercent,
      directAgentRatioPercent,
      displayRatioPercent,
      feeRatioPercent,
      minWithdrawalYuan,
      parentAgentRatioPercent,
      userSettlementRatioPercent,
    };
  }

  async function savePlatformConfig() {
    if (!adminAccessToken) {
      reportActionError('platform-config', '请先登录管理员账号');
      return;
    }
    if (!ensureSuperAdmin('platform-config')) {
      return;
    }

    const input = parsePlatformConfigDraft();
    if (!input) {
      return;
    }

    await runAction('platform-config', async (isCurrent) => {
      const result = await aiKsApi.updatePlatformConfig(
        adminAccessToken,
        input,
      );
      if (!isCurrent()) {
        return;
      }

      applyPlatformConfig(result);
      setNotice('平台配置已保存，后续新增同步和结算会按新配置执行');
    }, 'admin');
  }

  async function createCompanyAdmin(payload: {
    displayName: string;
    enabled: boolean;
    password: string;
    username: string;
  }) {
    if (!adminAccessToken) {
      reportActionError('company-admin-create', '请先登录管理员账号');
      return;
    }
    if (!ensureSuperAdmin('company-admin-create')) {
      return;
    }

    await runAction('company-admin-create', async (isCurrent) => {
      const result = await aiKsApi.createCompanyAdmin(adminAccessToken, payload);
      if (!isCurrent()) {
        return;
      }

      setCompanyAdmins((current) => [result.admin, ...current]);
      setNotice('公司管理员账号已创建');
    }, 'admin');
  }

  async function createAdminAgent() {
    if (!adminAccessToken) {
      reportActionError('agent-create', '请先登录管理员账号');
      return;
    }
    if (!ensureSuperAdmin('agent-create')) {
      return;
    }

    const username = newAgentUsername.trim();
    const password = newAgentPassword;
    const invitationCode = newAgentInvitationCode.trim();
    const parentAgentId = newAgentParentId.trim() || null;
    if (!username || !invitationCode || password.length < 8) {
      reportActionError(
        'agent-create',
        '请填写代理用户名、至少 8 位密码和邀请码',
      );
      return;
    }

    await runAction('agent-create', async (isCurrent) => {
      const result = await aiKsApi.createAdminAgent(adminAccessToken, {
        invitationCode,
        parentAgentId,
        password,
        username,
      });
      if (!isCurrent()) {
        return;
      }

      setAdminAgents((current) => [result.agent, ...current]);
      setNewAgentUsername('');
      setNewAgentPassword('');
      setNewAgentInvitationCode('');
      setNewAgentParentId('');
      setNotice('代理账号已创建，可复制代理 ID 到平台配置的默认代理 ID');
    }, 'admin');
  }

  async function updateAdminAgentAlipay() {
    if (!adminAccessToken) {
      reportActionError('agent-alipay', '请先登录管理员账号');
      return;
    }
    if (!ensureSuperAdmin('agent-alipay')) {
      return;
    }
    if (
      !agentActionAgentId ||
      !agentAlipayAccount.trim() ||
      !agentAlipayRealName.trim()
    ) {
      reportActionError('agent-alipay', '请选择代理并填写支付宝账号和真实姓名');
      return;
    }

    await runAction('agent-alipay', async (isCurrent) => {
      const result = await aiKsApi.updateAdminAgentAlipay(
        adminAccessToken,
        agentActionAgentId,
        {
          alipayAccount: agentAlipayAccount.trim(),
          alipayRealName: agentAlipayRealName.trim(),
        },
      );
      if (!isCurrent()) {
        return;
      }

      setAdminAgents((current) =>
        current.map((agent) => (agent.id === result.agent.id ? result.agent : agent)),
      );
      setNotice('代理支付宝资料已保存');
    }, 'admin');
  }

  async function requestAdminAgentWithdrawal() {
    if (!adminAccessToken) {
      reportActionError('agent-withdrawal', '请先登录管理员账号');
      return;
    }
    if (!ensureSuperAdmin('agent-withdrawal')) {
      return;
    }
    if (!agentActionAgentId || !agentWithdrawalAmountYuan.trim()) {
      reportActionError('agent-withdrawal', '请选择代理并填写提现金额');
      return;
    }

    await runAction('agent-withdrawal', async (isCurrent) => {
      await aiKsApi.requestAdminAgentWithdrawal(
        adminAccessToken,
        agentActionAgentId,
        {
          amountYuan: agentWithdrawalAmountYuan.trim(),
        },
      );
      if (!isCurrent()) {
        return;
      }

      setAgentWithdrawalAmountYuan('');
      await Promise.allSettled([
        loadAdminAgentsForToken(adminAccessToken, isCurrent),
        loadAdminWithdrawalsForToken(
          adminAccessToken,
          'PENDING_REVIEW',
          isCurrent,
        ),
      ]);
      if (!isCurrent()) {
        return;
      }

      setAdminWithdrawalStatus('PENDING_REVIEW');
      setNotice('代理提现已提交，请到提现页审核');
    }, 'admin');
  }

  async function updateCompanyAdmin(
    adminId: string,
    payload: { displayName: string; enabled: boolean; password?: string },
  ) {
    if (!adminAccessToken) {
      reportActionError('company-admin-update', '请先登录管理员账号');
      return;
    }
    if (!ensureSuperAdmin('company-admin-update')) {
      return;
    }

    await runAction('company-admin-update', async (isCurrent) => {
      const result = await aiKsApi.updateCompanyAdmin(
        adminAccessToken,
        adminId,
        payload,
      );
      if (!isCurrent()) {
        return;
      }

      setCompanyAdmins((current) =>
        current.map((admin) => (admin.id === result.admin.id ? result.admin : admin)),
      );
      setNotice('公司管理员账号已更新');
    }, 'admin');
  }

  async function updateCompanyAdminScopes(
    adminId: string,
    payload: { scopes: Array<{ companyId: string; gameIds: string[] }> },
  ) {
    if (!adminAccessToken) {
      reportActionError('company-admin-scopes', '请先登录管理员账号');
      return;
    }
    if (!ensureSuperAdmin('company-admin-scopes')) {
      return;
    }

    await runAction('company-admin-scopes', async (isCurrent) => {
      const result = await aiKsApi.updateCompanyAdminScopes(
        adminAccessToken,
        adminId,
        payload,
      );
      if (!isCurrent()) {
        return;
      }

      setCompanyAdmins((current) =>
        current.map((admin) => (admin.id === result.admin.id ? result.admin : admin)),
      );
      setNotice('公司管理员授权范围已保存');
    }, 'admin');
  }

  async function loadAdminResources() {
    if (!adminAccessToken) {
      reportActionError('admin-resources', '请先登录管理员账号');
      return;
    }

    await runAction('admin-resources', async (isCurrent) => {
      const loaded = await loadAdminResourcesForToken(adminAccessToken, isCurrent);
      if (!isCurrent()) {
        return;
      }
      if (!loaded) {
        return false;
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

  function applyKuaishouOAuthCallbackFromLocation() {
    if (typeof window === 'undefined') {
      return;
    }

    const callback = readKuaishouOAuthCallback(window.location.search);
    if (!callback) {
      return;
    }

    setLoginMode('admin');
    setKuaishouAuthCode(callback.authCode);
    if (callback.appId) {
      setKuaishouAppId(callback.appId);
    }
    setNotice('已读取快手授权回调 auth_code，请登录超级管理员后提交授权');
    window.history.replaceState(
      null,
      document.title,
      `${window.location.pathname}${window.location.hash}`,
    );
  }

  async function loadKuaishouTokenStatusForToken(
    token: string,
    isCurrent = () => true,
    options: LoadOptions = {},
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

      if (options.reportError ?? true) {
        setError(
          nextError instanceof Error ? nextError.message : '请求失败，请检查 API',
        );
      }
      return false;
    }
  }

  async function loadKuaishouTokenStatus() {
    if (!adminAccessToken) {
      reportActionError('kuaishou-token', '请先登录管理员账号');
      return;
    }
    if (!ensureSuperAdmin('kuaishou-token')) {
      return;
    }

    await runAction('kuaishou-token', async (isCurrent) => {
      const loaded = await loadKuaishouTokenStatusForToken(
        adminAccessToken,
        isCurrent,
      );
      if (!isCurrent()) {
        return;
      }
      if (!loaded) {
        return false;
      }

      setNotice('平台授权状态已刷新');
    }, 'admin');
  }

  async function loadKuaishouEcpmJobsForToken(
    token: string,
    isCurrent = () => true,
    options: LoadOptions = {},
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

      if (options.reportError ?? true) {
        setError(
          nextError instanceof Error ? nextError.message : '请求失败，请检查 API',
        );
      }
      return false;
    }
  }

  async function loadConfigKuaishouEcpmJobsForGame(
    token: string,
    game: AdminGame,
    isCurrent = () => true,
    options: { reportError?: boolean } = {},
  ) {
    const requestVersion = configEcpmJobsRequestVersionRef.current + 1;
    configEcpmJobsRequestVersionRef.current = requestVersion;

    const isCurrentConfigGame = () =>
      isCurrent() &&
      requestVersion === configEcpmJobsRequestVersionRef.current &&
      selectedConfigGameIdRef.current === game.id;

    try {
      const result = await aiKsApi.getKuaishouEcpmJobs(
        token,
        20,
        game.gameAppId,
      );
      if (!isCurrentConfigGame()) {
        return false;
      }

      setConfigKuaishouEcpmJobs(result.jobs);
      return true;
    } catch (nextError) {
      if (!isCurrentConfigGame()) {
        return false;
      }

      if (nextError instanceof ApiError && nextError.status === 401) {
        handleUnauthorized('admin');
        setError(nextError.message);
        return false;
      }

      if (options.reportError ?? true) {
        setError(
          nextError instanceof Error ? nextError.message : '请求失败，请检查 API',
        );
      }
      return false;
    }
  }

  async function loadKuaishouEcpmJobs() {
    if (!adminAccessToken) {
      reportActionError('kuaishou-ecpm-jobs', '请先登录管理员账号');
      return;
    }

    await runAction('kuaishou-ecpm-jobs', async (isCurrent) => {
      const loaded = await loadKuaishouEcpmJobsForToken(
        adminAccessToken,
        isCurrent,
      );
      if (!isCurrent()) {
        return;
      }
      if (!loaded) {
        return false;
      }

      setNotice('同步任务已刷新');
    }, 'admin');
  }

  function upsertEcpmUpdateJob(nextJob: EcpmUpdateJob) {
    setEcpmUpdateJobs((current) => upsertEcpmUpdateJobList(current, nextJob));
  }

  async function queryEcpmDashboard(
    scope: EcpmDashboardScope,
    query: Record<string, string | undefined>,
  ) {
    if (!adminAccessToken) {
      reportActionError('ecpm-dashboard', '请先登录管理员账号');
      return;
    }

    await runAction('ecpm-dashboard', async (isCurrent) => {
      const result = await aiKsApi.getEcpmDashboard(
        adminAccessToken,
        scope,
        query,
      );
      if (!isCurrent()) {
        return;
      }

      setEcpmDashboardRows(result.rows);
      setNotice(`ECPM 看板已查询，返回 ${result.rows.length} 条数据`);
    }, 'admin');
  }

  async function loadEcpmUpdateJobsForToken(
    token: string,
    isCurrent = () => true,
    options: LoadOptions = {},
  ) {
    try {
      const result = await aiKsApi.getEcpmUpdateJobs(token, 20);
      if (!isCurrent()) {
        return false;
      }

      setEcpmUpdateJobs(result.jobs);
      setSelectedEcpmUpdateJob((current) =>
        reconcileSelectedEcpmUpdateJob(current, result.jobs),
      );
      return result.jobs;
    } catch (nextError) {
      if (!isCurrent()) {
        return false;
      }

      if (nextError instanceof ApiError && nextError.status === 401) {
        handleUnauthorized('admin');
        setError(nextError.message);
        return false;
      }

      if (options.reportError ?? true) {
        setError(
          nextError instanceof Error ? nextError.message : '请求失败，请检查 API',
        );
      }
      return false;
    }
  }

  async function loadEcpmUpdateJobs() {
    if (!adminAccessToken) {
      reportActionError('ecpm-jobs', '请先登录管理员账号');
      return;
    }
    if (!ensureSuperAdmin('ecpm-jobs')) {
      return;
    }

    await runAction('ecpm-jobs', async (isCurrent) => {
      const loaded = await loadEcpmUpdateJobsForToken(
        adminAccessToken,
        isCurrent,
      );
      if (!isCurrent()) {
        return;
      }
      if (!loaded) {
        return false;
      }

      setNotice('ECPM 更新任务已刷新');
    }, 'admin');
  }

  async function loadEcpmUpdateJob(jobId: string) {
    if (!adminAccessToken) {
      reportActionError('ecpm-jobs', '请先登录管理员账号');
      return;
    }
    if (!ensureSuperAdmin('ecpm-jobs')) {
      return;
    }

    await runAction('ecpm-jobs', async (isCurrent) => {
      const job = await aiKsApi.getEcpmUpdateJob(adminAccessToken, jobId);
      if (!isCurrent()) {
        return;
      }

      setSelectedEcpmUpdateJob(job);
      upsertEcpmUpdateJob(job);
      setNotice(`ECPM 更新任务 ${job.id} 已加载，状态 ${job.status}`);
    }, 'admin');
  }

  async function updateEcpm(request: EcpmUpdateRequest) {
    if (!adminAccessToken) {
      reportActionError('ecpm-update', '请先登录管理员账号');
      return;
    }
    if (!ensureSuperAdmin('ecpm-update')) {
      return;
    }

    await runAction('ecpm-update', async (isCurrent) => {
      const job = await aiKsApi.updateEcpm(adminAccessToken, request);
      if (!isCurrent()) {
        return;
      }

      setSelectedEcpmUpdateJob(job);
      const [jobsResult] = await Promise.allSettled([
        loadEcpmUpdateJobsForToken(adminAccessToken, isCurrent, {
          reportError: false,
        }),
        aiKsApi
          .getEcpmDashboard(adminAccessToken, 'latest', {})
          .then((result) => {
            if (isCurrent()) {
              setEcpmDashboardRows(result.rows);
            }
          }),
      ]);
      if (!isCurrent()) {
        return;
      }

      const refreshedJobs =
        jobsResult.status === 'fulfilled' && jobsResult.value !== false
          ? jobsResult.value
          : undefined;
      const refreshedJob = refreshedJobs?.find((row) => row.id === job.id);
      if (refreshedJob) {
        setSelectedEcpmUpdateJob(mergeEcpmUpdateJob(job, refreshedJob));
      } else {
        setSelectedEcpmUpdateJob(job);
        upsertEcpmUpdateJob(job);
      }
      setNotice(`ECPM 更新任务 ${job.id} 已提交，状态 ${job.status}`);
    }, 'admin');
  }

  async function authorizeKuaishouToken() {
    if (!adminAccessToken) {
      reportActionError('kuaishou-authorize', '请先登录管理员账号');
      return;
    }
    if (!ensureSuperAdmin('kuaishou-authorize')) {
      return;
    }

    const appId = kuaishouAppId.trim();
    const secret = kuaishouSecret.trim();
    const authCode = kuaishouAuthCode.trim();
    if (!appId || !secret || !authCode) {
      reportActionError(
        'kuaishou-authorize',
        '请填写平台 app_id、secret 和 auth_code',
      );
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
      reportActionError('kuaishou-refresh-token', '请先登录管理员账号');
      return;
    }
    if (!ensureSuperAdmin('kuaishou-refresh-token')) {
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

  async function resetTestData() {
    if (!adminAccessToken) {
      reportActionError('reset-test-data', '请先登录管理员账号');
      return;
    }
    if (!ensureSuperAdmin('reset-test-data')) {
      return;
    }

    await runAction('reset-test-data', async (isCurrent) => {
      await aiKsApi.resetTestData(adminAccessToken);
      if (!isCurrent()) {
        return;
      }

      clearAdminResourceState();
      clearKuaishouTokenState();
      setKuaishouEcpmJobs([]);
      setConfigKuaishouEcpmJobs([]);
      setGameSession(undefined);
      setRefreshResult(undefined);
      setSettlementPreview(undefined);
      setSettlementBatches([]);
      setSelectedSettlementDetail(undefined);
      setAdminWithdrawals([]);
      setAuditLogs([]);
      setSelectedWithdrawalDetail(undefined);
      setGameAppId('');
      setJsCode('');
      await reloadDemoContext(isCurrent);
      if (!isCurrent()) {
        return;
      }

      setNotice('测试数据已清空，基础上下文已重新加载，可直接开始下一轮联调');
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
      reportActionError('company-create', '请先登录管理员账号');
      return;
    }
    if (!ensureSuperAdmin('company-create')) {
      return;
    }

    const name = newCompanyName.trim();
    if (!name) {
      reportActionError('company-create', '请输入公司名称');
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
      reportActionError('company-balance', '请先登录管理员账号');
      return;
    }
    if (!ensureSuperAdmin('company-balance')) {
      return;
    }

    if (!balanceCompanyId || !balanceAmountYuan.trim()) {
      reportActionError('company-balance', '请选择公司并填写充值金额');
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
      reportActionError('game-create', '请先登录管理员账号');
      return;
    }
    if (!ensureSuperAdmin('game-create')) {
      return;
    }

    const companyId = newGameCompanyId.trim();
    const name = newGameName.trim();
    const nextGameAppId = newGameAppId.trim();
    const gameSecret = newGameSecret.trim();
    if (!companyId || !name || !nextGameAppId || !gameSecret) {
      reportActionError('game-create', '请填写公司、游戏名称、AppID 和密钥');
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
      reportActionError('game-budget', '请先登录管理员账号');
      return;
    }
    if (!ensureSuperAdmin('game-budget')) {
      return;
    }

    if (!budgetGameId || !budgetAmountYuan.trim()) {
      reportActionError('game-budget', '请选择游戏并填写分配金额');
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

  function openGameConfig(gameId: string) {
    const game = adminGames.find((row) => row.id === gameId);
    if (!game) {
      reportActionError('game-config', '未找到要配置的游戏');
      return;
    }

    selectedConfigGameIdRef.current = game.id;
    setSelectedConfigGameId(game.id);
    setConfigSection('basic');
    setConfigGameDraft(buildGameConfigDraft(game));
    setConfigBudgetAmountYuan('');
    setConfigBudgetReason('');
    setConfigEcpmLookbackHours(3);
    setConfigKuaishouEcpmJobs([]);

    if (adminAccessToken) {
      const configSessionVersion = sessionVersionRef.current;
      void loadConfigKuaishouEcpmJobsForGame(
        adminAccessToken,
        game,
        () => isCurrentSessionVersion(configSessionVersion),
        {
          reportError: false,
        },
      );
    }
  }

  function closeGameConfig() {
    clearGameConfigState();
  }

  function changeConfigGameDraft(patch: Partial<GameConfigDraft>) {
    setConfigGameDraft((current) =>
      current ? { ...current, ...patch } : current,
    );
  }

  async function saveGameConfig() {
    if (!adminAccessToken) {
      reportActionError('game-config', '请先登录管理员账号');
      return;
    }
    if (!ensureSuperAdmin('game-config')) {
      return;
    }

    const game = selectedConfigGame;
    const draft = configGameDraft;
    if (!game || !draft) {
      reportActionError('game-config', '请选择要配置的游戏');
      return;
    }

    const name = draft.name.trim();
    const gameSecret = draft.gameSecret.trim();
    if (!name || !gameSecret) {
      reportActionError('game-config', '请填写游戏名称和密钥');
      return;
    }

    await runAction('game-config', async (isCurrent) => {
      const result = await aiKsApi.updateAdminGame(adminAccessToken, game.id, {
        ecpmAutoSyncEnabled: draft.ecpmAutoSyncEnabled,
        ecpmAutoSyncIntervalHours: draft.ecpmAutoSyncIntervalHours,
        gameSecret,
        name,
        settlementPaused: draft.settlementPaused,
      });
      if (!isCurrent()) {
        return;
      }

      await Promise.all([
        loadAdminResourcesForToken(adminAccessToken, isCurrent),
        reloadDemoContext(isCurrent),
      ]);
      if (!isCurrent()) {
        return;
      }

      setConfigGameDraft(buildGameConfigDraft(result.game));
      setNotice('游戏配置已保存');
    }, 'admin');
  }

  async function submitConfigBudget() {
    if (!adminAccessToken) {
      reportActionError('game-config-budget', '请先登录管理员账号');
      return;
    }
    if (!ensureSuperAdmin('game-config-budget')) {
      return;
    }

    const game = selectedConfigGame;
    if (!game || !configBudgetAmountYuan.trim()) {
      reportActionError('game-config-budget', '请选择游戏并填写分配金额');
      return;
    }

    await runAction('game-config-budget', async (isCurrent) => {
      await aiKsApi.allocateGameBudget(adminAccessToken, game.id, {
        amountYuan: configBudgetAmountYuan,
        reason: configBudgetReason,
      });
      if (!isCurrent()) {
        return;
      }

      setConfigBudgetAmountYuan('');
      await loadAdminResourcesForToken(adminAccessToken, isCurrent);
      if (!isCurrent()) {
        return;
      }

      setNotice('游戏配置预算已分配');
    }, 'admin');
  }

  async function refreshConfigGameEcpm() {
    if (!adminAccessToken) {
      reportActionError('game-config-ecpm-refresh', '请先登录管理员账号');
      return;
    }
    if (!ensureSuperAdmin('game-config-ecpm-refresh')) {
      return;
    }

    const game = selectedConfigGame;
    if (!game) {
      reportActionError('game-config-ecpm-refresh', '请选择要刷新的游戏');
      return;
    }

    await runAction('game-config-ecpm-refresh', async (isCurrent) => {
      const result = await aiKsApi.refreshEcpm(
        adminAccessToken,
        game.gameAppId,
        configEcpmLookbackHours,
      );
      if (!isCurrent()) {
        return;
      }

      setRefreshResult(result);
      await loadConfigKuaishouEcpmJobsForGame(
        adminAccessToken,
        game,
        isCurrent,
        {
          reportError: false,
        },
      );
      if (!isCurrent()) {
        return;
      }

      setNotice(`ECPM 手动刷新成功，写入 ${result.savedCount} 条明细`);
    }, 'admin');
  }

  async function bindAccountOpenId() {
    if (!account || !accessToken) {
      reportActionError('bind', '请先登录或注册账号');
      return;
    }

    const targetIdentity = bindIdentity.trim();
    if (!targetIdentity) {
      reportActionError('bind', '请输入要绑定的 open_id 或可读 ID');
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
      reportActionError('account-query', '请先登录或注册账号');
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

  async function loadAccountAgentBinding(token: string, isCurrent = () => true) {
    const binding = await aiKsApi.getAccountAgentBinding(token);
    if (!isCurrent()) {
      return;
    }

    setAccountAgentBinding(binding);
  }

  async function bindAccountAgent() {
    if (!account || !accessToken) {
      reportActionError('agent-binding', '请先登录或注册账号');
      return;
    }

    const targetInvitationCode = accountAgentInvitationCode.trim();
    if (!targetInvitationCode) {
      reportActionError('agent-binding', '请输入代理邀请码');
      return;
    }

    await runAction('agent-binding', async (isCurrent) => {
      const binding = await aiKsApi.bindAccountAgent(
        accessToken,
        targetInvitationCode,
      );
      if (!isCurrent()) {
        return;
      }

      setAccountAgentBinding(binding);
      setAccountAgentInvitationCode('');
      setNotice('代理归属已更新，后续新结算会按当前代理分账');
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
      reportActionError('alipay', '请先登录或注册账号');
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
      reportActionError('withdrawal', '请先登录或注册账号');
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

  function applyAgentProfile(profile: AgentProfile) {
    const nextAgent = pickAgentPrincipal(profile);
    setCurrentAgent(nextAgent);
    setAgentProfile(profile);
    setOwnAgentAlipayAccount(profile.alipayAccount ?? '');
    setOwnAgentAlipayRealName(profile.alipayRealName ?? '');
  }

  async function loadAgentPortalForToken(
    token: string,
    isCurrent = () => true,
  ) {
    await Promise.allSettled([
      loadAgentProfileForToken(token, isCurrent),
      loadAgentEarningsForToken(token, isCurrent),
      loadAgentUsersForToken(token, isCurrent),
      loadAgentWithdrawalsForToken(token, isCurrent),
    ]);
  }

  async function loadAgentProfileForToken(token: string, isCurrent = () => true) {
    const profile = await aiKsApi.getCurrentAgent(token);
    if (!isCurrent()) {
      return;
    }

    applyAgentProfile(profile);
  }

  async function loadAgentEarningsForToken(
    token: string,
    isCurrent = () => true,
  ) {
    const result = await aiKsApi.getAgentEarnings(token);
    if (!isCurrent()) {
      return;
    }

    setAgentEarnings(result);
  }

  async function loadAgentWithdrawalsForToken(
    token: string,
    isCurrent = () => true,
  ) {
    const result = await aiKsApi.getAgentWithdrawals(token);
    if (!isCurrent()) {
      return;
    }

    setAgentWithdrawals(result.batches);
  }

  async function loadAgentUsersForToken(token: string, isCurrent = () => true) {
    const result = await aiKsApi.getAgentUsers(token);
    if (!isCurrent()) {
      return;
    }

    setAgentUsers(result);
  }

  async function loadAgentEarnings() {
    if (!agentAccessToken) {
      reportActionError('agent-earnings', '请先登录代理账号');
      return;
    }

    await runAction('agent-earnings', async (isCurrent) => {
      await loadAgentEarningsForToken(agentAccessToken, isCurrent);
      if (!isCurrent()) {
        return;
      }

      setNotice('代理收益已刷新');
    }, 'agent');
  }

  async function loadAgentWithdrawals() {
    if (!agentAccessToken) {
      reportActionError('agent-withdrawals', '请先登录代理账号');
      return;
    }

    await runAction('agent-withdrawals', async (isCurrent) => {
      await loadAgentWithdrawalsForToken(agentAccessToken, isCurrent);
      if (!isCurrent()) {
        return;
      }

      setNotice('代理提现批次已刷新');
    }, 'agent');
  }

  async function loadAgentUsers() {
    if (!agentAccessToken) {
      reportActionError('agent-users', '请先登录代理账号');
      return;
    }

    await runAction('agent-users', async (isCurrent) => {
      await loadAgentUsersForToken(agentAccessToken, isCurrent);
      if (!isCurrent()) {
        return;
      }

      setNotice('代理名下用户已刷新');
    }, 'agent');
  }

  async function updateOwnAgentAlipayProfile() {
    if (!agentAccessToken) {
      reportActionError('agent-alipay-own', '请先登录代理账号');
      return;
    }

    await runAction('agent-alipay-own', async (isCurrent) => {
      const profile = await aiKsApi.updateAgentAlipayProfile(agentAccessToken, {
        alipayAccount: ownAgentAlipayAccount,
        alipayRealName: ownAgentAlipayRealName,
      });
      if (!isCurrent()) {
        return;
      }

      setOwnAgentAlipayAccount(profile.alipayAccount ?? '');
      setOwnAgentAlipayRealName(profile.alipayRealName ?? '');
      await loadAgentProfileForToken(agentAccessToken, isCurrent);
      if (!isCurrent()) {
        return;
      }

      setNotice('代理支付宝资料已保存');
    }, 'agent');
  }

  async function requestOwnAgentWithdrawal() {
    if (!agentAccessToken) {
      reportActionError('agent-withdrawal-own', '请先登录代理账号');
      return;
    }

    await runAction('agent-withdrawal-own', async (isCurrent) => {
      const result = await aiKsApi.requestAgentWithdrawal(
        agentAccessToken,
        ownAgentWithdrawalAmountYuan,
      );
      if (!isCurrent()) {
        return;
      }

      setOwnAgentWithdrawalAmountYuan('');
      setAgentWithdrawals((current) => [result, ...current]);
      await Promise.allSettled([
        loadAgentProfileForToken(agentAccessToken, isCurrent),
        loadAgentWithdrawalsForToken(agentAccessToken, isCurrent),
      ]);
      if (!isCurrent()) {
        return;
      }

      setNotice('代理提现已提交，等待超级管理员审核');
    }, 'agent');
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
    setSelectedSettlementDetail(undefined);
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
    setSelectedSettlementDetail((current) =>
      current && result.batches.some((batch) => batch.id === current.batch.id)
        ? current
        : undefined,
    );
  }

  function nextSettlementBatchRequestVersion() {
    settlementBatchRequestVersionRef.current += 1;
    return settlementBatchRequestVersionRef.current;
  }

  async function loadSettlementBatchesForGame(
    token: string,
    targetGameId: string,
    isCurrentSession = () => true,
    options: LoadOptions = {},
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

      if (options.reportError ?? true) {
        setError(
          nextError instanceof Error ? nextError.message : '请求失败，请检查 API',
        );
      }
      return false;
    }
  }

  async function loadSettlementDetail(batchId: string) {
    if (!adminAccessToken) {
      reportActionError(`settlement-detail-${batchId}`, '请先登录管理员账号');
      return;
    }

    await runAction(`settlement-detail-${batchId}`, async (isCurrent) => {
      const result = await aiKsApi.getSettlementDetail(
        adminAccessToken,
        batchId,
      );
      if (!isCurrent()) {
        return;
      }

      setSelectedSettlementDetail(result);
      setNotice(`已加载结算批次 ${batchId}`);
    }, 'admin');
  }

  async function previewSettlement() {
    if (!adminAccessToken) {
      reportActionError('settlement-preview', '请先登录管理员账号');
      return;
    }
    if (!ensureSuperAdmin('settlement-preview')) {
      return;
    }

    if (!getSettlementGameId()) {
      reportActionError('settlement-preview', '请选择要结算的游戏');
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
      reportActionError('settlement-confirm', '请先登录管理员账号');
      return;
    }
    if (!ensureSuperAdmin('settlement-confirm')) {
      return;
    }

    if (!getSettlementGameId()) {
      reportActionError('settlement-confirm', '请选择要结算的游戏');
      return;
    }

    if (!canConfirmSettlement()) {
      reportActionError('settlement-confirm', '请先预览可结算收益');
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
      setSelectedSettlementDetail({
        batch: result.batch,
        items: result.items,
      });
      const batchesLoaded = await loadSettlementBatchesForGame(
        adminAccessToken,
        range.gameId,
        isCurrent,
      );
      if (!isCurrent()) {
        return;
      }
      if (!batchesLoaded) {
        return false;
      }

      setNotice(`结算成功，入账 ${result.batch.settledCount} 条`);
    }, 'admin');
  }

  async function loadAdminWithdrawals(statusFilter = adminWithdrawalStatus) {
    if (!adminAccessToken) {
      reportActionError('admin-withdrawals', '请先登录管理员账号');
      return;
    }

    await runAction('admin-withdrawals', async (isCurrent) => {
      const loadedCount = await loadAdminWithdrawalsForToken(
        adminAccessToken,
        statusFilter,
        isCurrent,
      );
      if (!isCurrent()) {
        return;
      }
      if (loadedCount === undefined) {
        return false;
      }

      setNotice(`提现批次 ${loadedCount} 笔`);
    }, 'admin');
  }

  async function loadAdminWithdrawalsForToken(
    token: string,
    statusFilter = adminWithdrawalStatus,
    isCurrent = () => true,
    options: LoadOptions = {},
  ) {
    try {
      const result = await aiKsApi.getAdminWithdrawals(token, statusFilter);
      if (!isCurrent()) {
        return undefined;
      }

      setAdminWithdrawals(result.batches);
      setAdminWithdrawalStatus(statusFilter);
      return result.batches.length;
    } catch (nextError) {
      if (!isCurrent()) {
        return undefined;
      }

      if (nextError instanceof ApiError && nextError.status === 401) {
        handleUnauthorized('admin');
        setError(nextError.message);
        return undefined;
      }

      if (options.reportError ?? true) {
        setError(
          nextError instanceof Error ? nextError.message : '请求失败，请检查 API',
        );
      }
      return undefined;
    }
  }

  async function approveAdminWithdrawal(batchId: string) {
    if (!adminAccessToken) {
      reportActionError(`approve-${batchId}`, '请先登录管理员账号');
      return;
    }
    if (!ensureSuperAdmin(`approve-${batchId}`)) {
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
      reportActionError(`pay-${mockResult}-${batchId}`, '请先登录管理员账号');
      return;
    }
    if (!ensureSuperAdmin(`pay-${mockResult}-${batchId}`)) {
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
      reportActionError(`close-${batchId}`, '请先登录管理员账号');
      return;
    }
    if (!ensureSuperAdmin(`close-${batchId}`)) {
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
      reportActionError(`detail-${batchId}`, '请先登录管理员账号');
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
      reportActionError('audit-logs', '请先登录管理员账号');
      return;
    }

    await runAction('audit-logs', async (isCurrent) => {
      const loadedCount = await loadAuditLogsForToken(
        adminAccessToken,
        isCurrent,
      );
      if (!isCurrent()) {
        return;
      }
      if (loadedCount === undefined) {
        return false;
      }

      setNotice(`审计日志 ${loadedCount} 条`);
    }, 'admin');
  }

  async function loadAuditLogsForToken(
    token: string,
    isCurrent = () => true,
    options: LoadOptions = {},
  ) {
    try {
      const result = await aiKsApi.getAuditLogs(token);
      if (!isCurrent()) {
        return undefined;
      }

      setAuditLogs(result.logs);
      return result.logs.length;
    } catch (nextError) {
      if (!isCurrent()) {
        return undefined;
      }

      if (nextError instanceof ApiError && nextError.status === 401) {
        handleUnauthorized('admin');
        setError(nextError.message);
        return undefined;
      }

      if (options.reportError ?? true) {
        setError(
          nextError instanceof Error ? nextError.message : '请求失败，请检查 API',
        );
      }
      return undefined;
    }
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
  const operationFeedback = (
    <OperationFeedback
      items={operationFeedbackItems}
      onClear={() => setOperationFeedbackItems([])}
    />
  );

  if (appSession.mode === 'signed-out') {
    return (
      <>
        {alerts}
        {operationFeedback}
        <LoginPage
          adminPassword={adminPassword}
          adminUsername={adminUsername}
          agentPassword={agentPassword}
          agentUsername={agentUsername}
          busyAction={loginBusyAction(busyAction)}
          invitationCode={invitationCode}
          mode={loginMode}
          onAdminPasswordChange={setAdminPassword}
          onAdminUsernameChange={setAdminUsername}
          onAgentPasswordChange={setAgentPassword}
          onAgentUsernameChange={setAgentUsername}
          onGuestEnter={enterGuestMode}
          onInvitationCodeChange={setInvitationCode}
          onLoginAccount={loginAccount}
          onLoginAgent={loginAgent}
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
      {operationFeedback}
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
          agentBinding={accountAgentBinding}
          agentInvitationCode={accountAgentInvitationCode}
          alipayAccount={alipayAccount}
          alipayRealName={alipayRealName}
          bindIdentity={bindIdentity}
          busyAction={accountBusyAction(busyAction)}
          onAgentInvitationCodeChange={setAccountAgentInvitationCode}
          onAlipayAccountChange={setAlipayAccount}
          onAlipayRealNameChange={setAlipayRealName}
          onBindAgent={bindAccountAgent}
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
      {activeView === 'agent' && appSession.mode === 'agent' ? (
        <AgentWorkspace
          agent={currentAgent}
          alipayAccount={ownAgentAlipayAccount}
          alipayRealName={ownAgentAlipayRealName}
          busyAction={agentBusyAction(busyAction)}
          earnings={agentEarnings}
          onAlipayAccountChange={setOwnAgentAlipayAccount}
          onAlipayRealNameChange={setOwnAgentAlipayRealName}
          onLoadEarnings={loadAgentEarnings}
          onLoadUsers={loadAgentUsers}
          onLoadWithdrawals={loadAgentWithdrawals}
          onRequestWithdrawal={requestOwnAgentWithdrawal}
          onUpdateAlipayProfile={updateOwnAgentAlipayProfile}
          onWithdrawalAmountChange={setOwnAgentWithdrawalAmountYuan}
          profile={agentProfile}
          users={agentUsers}
          withdrawalAmountYuan={ownAgentWithdrawalAmountYuan}
          withdrawals={agentWithdrawals}
        />
      ) : null}
      {activeView === 'operations' && appSession.mode === 'admin' ? (
        <OperationsWorkspace
          adminCompanies={adminCompanies}
          adminGames={adminGames}
          adminName={adminName}
          adminWithdrawalStatus={adminWithdrawalStatus}
          adminWithdrawals={adminWithdrawals}
          adminAgents={adminAgents}
          agentActionAgentId={agentActionAgentId}
          agentAlipayAccount={agentAlipayAccount}
          agentAlipayRealName={agentAlipayRealName}
          agentWithdrawalAmountYuan={agentWithdrawalAmountYuan}
          auditLogs={auditLogs}
          balanceAmountYuan={balanceAmountYuan}
          balanceCompanyId={balanceCompanyId}
          balanceReason={balanceReason}
          budgetAmountYuan={budgetAmountYuan}
          budgetGameId={budgetGameId}
          budgetReason={budgetReason}
          busyAction={operationsBusyAction(busyAction)}
          businessClosure={businessClosure}
          companyAdmins={companyAdmins}
          configBudgetAmountYuan={configBudgetAmountYuan}
          configBudgetReason={configBudgetReason}
          configEcpmLookbackHours={configEcpmLookbackHours}
          configGameDraft={configGameDraft}
          configKuaishouEcpmJobs={configKuaishouEcpmJobs}
          configSection={configSection}
          ecpmJobs={isSuperAdmin(currentAdmin) ? ecpmUpdateJobs : []}
          ecpmRows={ecpmDashboardRows}
          gameAppId={gameAppId}
          games={games}
          isSuperAdmin={isSuperAdmin(currentAdmin)}
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
          newAgentInvitationCode={newAgentInvitationCode}
          newAgentParentId={newAgentParentId}
          newAgentPassword={newAgentPassword}
          newAgentUsername={newAgentUsername}
          onLoadPlatformConfig={loadPlatformConfig}
          onAdjustCompanyBalance={adjustCompanyBalance}
          onAllocateGameBudget={allocateGameBudget}
          onApproveWithdrawal={approveAdminWithdrawal}
          onBalanceAmountChange={setBalanceAmountYuan}
          onBalanceCompanyIdChange={setBalanceCompanyId}
          onBalanceReasonChange={setBalanceReason}
          onBudgetAmountChange={setBudgetAmountYuan}
          onBudgetGameIdChange={setBudgetGameId}
          onBudgetReasonChange={setBudgetReason}
          onCloseGameConfig={closeGameConfig}
          onCloseWithdrawal={closeAdminWithdrawal}
          onConfirmSettlement={confirmSettlement}
          onConfigBudgetAmountChange={setConfigBudgetAmountYuan}
          onConfigBudgetReasonChange={setConfigBudgetReason}
          onConfigEcpmLookbackHoursChange={setConfigEcpmLookbackHours}
          onConfigGameDraftChange={changeConfigGameDraft}
          onConfigSectionChange={setConfigSection}
          onAgentActionAgentIdChange={changeAgentActionAgentId}
          onAgentAlipayAccountChange={setAgentAlipayAccount}
          onAgentAlipayRealNameChange={setAgentAlipayRealName}
          onAgentWithdrawalAmountChange={setAgentWithdrawalAmountYuan}
          onCreateCompany={createAdminCompany}
          onCreateAgent={createAdminAgent}
          onCreateCompanyAdmin={createCompanyAdmin}
          onCreateGame={createAdminGame}
          onCreateSession={createGameSession}
          onEcpmDashboardQuery={queryEcpmDashboard}
          onEcpmJobSelect={
            isSuperAdmin(currentAdmin) ? loadEcpmUpdateJob : undefined
          }
          onEcpmJobsRefresh={
            isSuperAdmin(currentAdmin) ? loadEcpmUpdateJobs : undefined
          }
          onEcpmUpdate={isSuperAdmin(currentAdmin) ? updateEcpm : undefined}
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
          onLoadAdminAgents={loadAdminAgents}
          onLoadAuditLogs={loadAuditLogs}
          onLoadBusinessClosure={loadBusinessClosure}
          onLoadCompanyAdmins={loadCompanyAdmins}
          onLoadSettlementDetail={loadSettlementDetail}
          onLoadWithdrawalDetail={loadWithdrawalDetail}
          onLoadWithdrawals={loadAdminWithdrawals}
          onNewCompanyNameChange={setNewCompanyName}
          onNewAgentInvitationCodeChange={setNewAgentInvitationCode}
          onNewAgentParentIdChange={setNewAgentParentId}
          onNewAgentPasswordChange={setNewAgentPassword}
          onNewAgentUsernameChange={setNewAgentUsername}
          onNewGameAppIdChange={setNewGameAppId}
          onNewGameCompanyIdChange={setNewGameCompanyId}
          onNewGameNameChange={setNewGameName}
          onNewGameSecretChange={setNewGameSecret}
          onPayWithdrawal={payAdminWithdrawal}
          onPlatformConfigDraftChange={changePlatformConfigDraft}
          onPreviewSettlement={previewSettlement}
          onResetTestData={resetTestData}
          onOpenGameConfig={openGameConfig}
          onRefreshConfigGameEcpm={refreshConfigGameEcpm}
          onRefreshEcpm={refreshEcpm}
          onRetryKuaishouEcpmJob={retryKuaishouEcpmJob}
          onRequestAgentWithdrawal={requestAdminAgentWithdrawal}
          onSaveGameConfig={saveGameConfig}
          onSavePlatformConfig={savePlatformConfig}
          onSettlementEndDateChange={changeSettlementEndDate}
          onSettlementStartDateChange={changeSettlementStartDate}
          onSettlementUserIdChange={changeSettlementUserId}
          onSubmitConfigBudget={submitConfigBudget}
          onUpdateAgentAlipay={updateAdminAgentAlipay}
          onUpdateCompanyAdmin={updateCompanyAdmin}
          onUpdateCompanyAdminScopes={updateCompanyAdminScopes}
          operationsOverview={operationsOverview}
          platformConfig={platformConfig}
          platformConfigDraft={platformConfigDraft}
          refreshResult={refreshResult}
          sampleJsCodes={sampleJsCodes}
          selectedConfigGame={selectedConfigGame}
          selectedConfigGameId={selectedConfigGameId}
          selectedEcpmJob={
            isSuperAdmin(currentAdmin) ? selectedEcpmUpdateJob : undefined
          }
          selectedSettlementDetail={selectedSettlementDetail}
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
    case 'agent-login':
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
    case 'agent-binding':
    case 'alipay':
    case 'bind':
    case 'withdrawal':
      return action;
    default:
      return '';
  }
}

function agentBusyAction(action: AppBusyAction): AgentWorkspaceBusyAction {
  switch (action) {
    case 'agent-alipay-own':
    case 'agent-earnings':
    case 'agent-users':
    case 'agent-withdrawal-own':
    case 'agent-withdrawals':
      return action;
    default:
      return '';
  }
}

function pickAgentPrincipal(agent: AgentPrincipal): AgentPrincipal {
  return {
    id: agent.id,
    invitationCode: agent.invitationCode,
    username: agent.username,
  };
}

function parseIntegerPercent(value: string) {
  const parsed = Number(value.trim());
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 100) {
    return undefined;
  }

  return parsed;
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
    case 'agent-create':
    case 'agent-alipay':
    case 'agent-withdrawal':
    case 'agents':
    case 'admin-resources':
    case 'audit-logs':
    case 'business-closure':
    case 'company-admin-create':
    case 'company-admin-scopes':
    case 'company-admin-update':
    case 'company-admins':
    case 'company-balance':
    case 'company-create':
    case 'ecpm-dashboard':
    case 'ecpm-jobs':
    case 'ecpm-update':
    case 'game-budget':
    case 'game-config':
    case 'game-config-budget':
    case 'game-config-ecpm-refresh':
    case 'game-create':
    case 'kuaishou-authorize':
    case 'kuaishou-ecpm-jobs':
    case 'kuaishou-refresh-token':
    case 'kuaishou-token':
    case 'platform-config':
    case 'refresh':
    case 'reset-test-data':
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
        action.startsWith('pay-success-') ||
        action.startsWith('retry-ecpm-') ||
        action.startsWith('settlement-detail-')
      );
  }
}
