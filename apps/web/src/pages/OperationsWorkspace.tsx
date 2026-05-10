import { useEffect, useState } from 'react';
import { KeyRound, RefreshCw, Send, Settings, ShieldAlert, X } from 'lucide-react';
import {
  AuditLogTable,
  EcpmTable,
  ReadoutGrid,
  WithdrawalBatchTable,
} from '../components/domain';
import { EcpmOperationsCenter } from './EcpmOperationsCenter';
import {
  Button,
  Dialog,
  InputField,
  MetricCard,
  Panel,
  StatusBadge,
} from '../components/ui';
import { formatAuditMetadata, formatMoney } from '../lib/format';
import type { OperationsOverview } from '../lib/operationsOverview';
import type {
  AdminAgent,
  AdminCompany,
  AdminCompanyAdmin,
  AdminGame,
  AdminWithdrawalBatch,
  AdminWithdrawalDetailResult,
  AuditLogRow,
  AdminSettlementBatch,
  AdminSettlementDetailResult,
  AdminSettlementPreview,
  DemoGame,
  BusinessClosureReport,
  BusinessClosureStatus,
  EcpmDashboardRow,
  EcpmDashboardScope,
  EcpmRefreshResult,
  EcpmLookbackHours,
  EcpmUpdateJob,
  EcpmUpdateRequest,
  GameSessionResult,
  KuaishouEcpmSyncJob,
  KuaishouTokenStatusResult,
  PlatformConfig,
} from '../types/api';

export type OperationsWorkspaceBusyAction =
  | ''
  | 'admin-resources'
  | 'admin-withdrawals'
  | 'agent-alipay'
  | 'agent-create'
  | 'agent-withdrawal'
  | 'agents'
  | 'audit-logs'
  | 'business-closure'
  | 'company-admin-create'
  | 'company-admin-scopes'
  | 'company-admin-update'
  | 'company-admins'
  | 'company-balance'
  | 'company-create'
  | 'ecpm-dashboard'
  | 'ecpm-jobs'
  | 'ecpm-update'
  | 'game-budget'
  | 'game-config'
  | 'game-config-budget'
  | 'game-config-ecpm-refresh'
  | 'game-create'
  | 'kuaishou-authorize'
  | 'kuaishou-ecpm-jobs'
  | 'kuaishou-refresh-token'
  | 'kuaishou-token'
  | 'platform-config'
  | 'refresh'
  | 'reset-test-data'
  | 'settlement-confirm'
  | 'settlement-preview'
  | 'session'
  | `approve-${string}`
  | `close-${string}`
  | `detail-${string}`
  | `pay-failed-${string}`
  | `pay-success-${string}`
  | `retry-ecpm-${string}`
  | `settlement-detail-${string}`;

type GameConfigSection = 'audit' | 'basic' | 'budget' | 'ecpm';

type GameConfigDraft = {
  ecpmAutoSyncEnabled: boolean;
  ecpmAutoSyncIntervalHours: EcpmLookbackHours;
  gameSecret: string;
  name: string;
  settlementPaused: boolean;
};

type OperationsPane =
  | 'agents'
  | 'audit'
  | 'company'
  | 'company-admins'
  | 'ecpm'
  | 'game'
  | 'kuaishou'
  | 'maintenance'
  | 'overview'
  | 'config'
  | 'settlement'
  | 'withdrawal';

export type PlatformConfigDraft = {
  defaultAgentId: string;
  defaultAgentRatioPercent: string;
  directAgentRatioPercent: string;
  displayRatioPercent: string;
  feeRatioPercent: string;
  minWithdrawalYuan: string;
  parentAgentRatioPercent: string;
  userSettlementRatioPercent: string;
};

type SuperAdminDialog =
  | ''
  | 'create-agent'
  | 'allocate-budget'
  | 'authorize-kuaishou'
  | 'company-admin-scopes'
  | 'create-company-admin'
  | 'confirm-settlement'
  | 'create-company'
  | 'create-game'
  | 'recharge-company'
  | 'reset-test-data'
  | 'update-company-admin';

type WithdrawalActionKind = 'approve' | 'close' | 'pay-failed' | 'pay-success';

type PendingWithdrawalAction = {
  batchId: string;
  kind: WithdrawalActionKind;
};

export interface OperationsWorkspaceProps {
  adminAgents: AdminAgent[];
  adminCompanies: AdminCompany[];
  adminGames: AdminGame[];
  adminName: string;
  adminWithdrawalStatus: string;
  adminWithdrawals: AdminWithdrawalBatch[];
  agentActionAgentId: string;
  agentAlipayAccount: string;
  agentAlipayRealName: string;
  agentWithdrawalAmountYuan: string;
  auditLogs: AuditLogRow[];
  balanceAmountYuan: string;
  balanceCompanyId: string;
  balanceReason: string;
  budgetAmountYuan: string;
  budgetGameId: string;
  budgetReason: string;
  busyAction: OperationsWorkspaceBusyAction;
  businessClosure?: BusinessClosureReport;
  companyAdmins: AdminCompanyAdmin[];
  configBudgetAmountYuan: string;
  configBudgetReason: string;
  configEcpmLookbackHours: EcpmLookbackHours;
  configGameDraft?: GameConfigDraft;
  configKuaishouEcpmJobs: KuaishouEcpmSyncJob[];
  configSection: GameConfigSection;
  ecpmJobs?: EcpmUpdateJob[];
  ecpmRows?: EcpmDashboardRow[];
  gameAppId: string;
  games: DemoGame[];
  jsCode: string;
  isSuperAdmin: boolean;
  kuaishouAppId: string;
  kuaishouAuthCode: string;
  kuaishouEcpmJobs: KuaishouEcpmSyncJob[];
  kuaishouSecret: string;
  kuaishouTokenStatus?: KuaishouTokenStatusResult;
  newAgentInvitationCode: string;
  newAgentParentId: string;
  newAgentPassword: string;
  newAgentUsername: string;
  newCompanyName: string;
  newGameAppId: string;
  newGameCompanyId: string;
  newGameName: string;
  newGameSecret: string;
  operationsOverview: OperationsOverview;
  platformConfig: PlatformConfig;
  platformConfigDraft: PlatformConfigDraft;
  onAdjustCompanyBalance(): void;
  onAllocateGameBudget(): void;
  onApproveWithdrawal(batchId: string): void;
  onBalanceAmountChange(value: string): void;
  onBalanceCompanyIdChange(value: string): void;
  onBalanceReasonChange(value: string): void;
  onBudgetAmountChange(value: string): void;
  onBudgetGameIdChange(value: string): void;
  onBudgetReasonChange(value: string): void;
  onCloseGameConfig(): void;
  onCloseWithdrawal(batchId: string): void;
  onConfirmSettlement(): void;
  onConfigBudgetAmountChange(value: string): void;
  onConfigBudgetReasonChange(value: string): void;
  onConfigEcpmLookbackHoursChange(value: EcpmLookbackHours): void;
  onConfigGameDraftChange(patch: Partial<GameConfigDraft>): void;
  onConfigSectionChange(section: GameConfigSection): void;
  onAgentActionAgentIdChange(value: string): void;
  onAgentAlipayAccountChange(value: string): void;
  onAgentAlipayRealNameChange(value: string): void;
  onAgentWithdrawalAmountChange(value: string): void;
  onCreateAgent(): void;
  onCreateCompany(): void;
  onCreateCompanyAdmin(payload: {
    displayName: string;
    enabled: boolean;
    password: string;
    username: string;
  }): void;
  onCreateGame(): void;
  onCreateSession(): void;
  onEcpmDashboardQuery?(
    scope: EcpmDashboardScope,
    query: Record<string, string | undefined>,
  ): void;
  onEcpmJobSelect?(jobId: string): void;
  onEcpmUpdate?(request: EcpmUpdateRequest): void;
  onGameChange(value: string): void;
  onJsCodeChange(value: string): void;
  onKuaishouAppIdChange(value: string): void;
  onKuaishouAuthCodeChange(value: string): void;
  onKuaishouAuthorize(): void;
  onKuaishouRefreshToken(): void;
  onKuaishouSecretChange(value: string): void;
  onLoadKuaishouEcpmJobs(): void;
  onLoadKuaishouTokenStatus(): void;
  onLoadAdminResources(): void;
  onLoadAdminAgents(): void;
  onLoadAuditLogs(): void;
  onLoadBusinessClosure(): void;
  onLoadCompanyAdmins(): void;
  onLoadPlatformConfig(): void;
  onLoadSettlementDetail(batchId: string): void;
  onLoadWithdrawalDetail(batchId: string): void;
  onLoadWithdrawals(status?: string): void;
  onNewAgentInvitationCodeChange(value: string): void;
  onNewAgentParentIdChange(value: string): void;
  onNewAgentPasswordChange(value: string): void;
  onNewAgentUsernameChange(value: string): void;
  onNewCompanyNameChange(value: string): void;
  onNewGameAppIdChange(value: string): void;
  onNewGameCompanyIdChange(value: string): void;
  onNewGameNameChange(value: string): void;
  onNewGameSecretChange(value: string): void;
  onPayWithdrawal(batchId: string, result: 'failed' | 'success'): void;
  onPlatformConfigDraftChange(patch: Partial<PlatformConfigDraft>): void;
  onPreviewSettlement(): void;
  onResetTestData(): void;
  onOpenGameConfig(gameId: string): void;
  onRefreshConfigGameEcpm(): void;
  onRefreshEcpm(): void;
  onRetryKuaishouEcpmJob(jobId: string): void;
  onRequestAgentWithdrawal(): void;
  onSaveGameConfig(): void;
  onSavePlatformConfig(): void;
  onSettlementEndDateChange(value: string): void;
  onSettlementStartDateChange(value: string): void;
  onSettlementUserIdChange(value: string): void;
  onSubmitConfigBudget(): void;
  onUpdateAgentAlipay(): void;
  onUpdateCompanyAdmin(
    adminId: string,
    payload: { displayName: string; enabled: boolean; password?: string },
  ): void;
  onUpdateCompanyAdminScopes(
    adminId: string,
    payload: { scopes: Array<{ companyId: string; gameIds: string[] }> },
  ): void;
  refreshResult?: EcpmRefreshResult;
  sampleJsCodes: string[];
  selectedConfigGame?: AdminGame;
  selectedConfigGameId: string;
  selectedEcpmJob?: EcpmUpdateJob;
  selectedSettlementDetail?: AdminSettlementDetailResult;
  selectedGame?: DemoGame;
  selectedWithdrawalDetail?: AdminWithdrawalDetailResult;
  settlementBatches: AdminSettlementBatch[];
  settlementEndDate: string;
  settlementPreview?: AdminSettlementPreview;
  settlementStartDate: string;
  settlementUserId: string;
  session?: GameSessionResult;
}

function statusTone(status: string) {
  if (status === 'APPROVED' || status === 'COMPLETED') {
    return 'success';
  }

  if (status === 'FAILED' || status === 'REJECTED') {
    return 'danger';
  }

  return 'warning';
}

function tokenStatusTone(status?: KuaishouTokenStatusResult['status']) {
  if (status === 'ACTIVE') {
    return 'success';
  }

  if (status === 'ERROR') {
    return 'danger';
  }

  if (status === 'EXPIRED') {
    return 'warning';
  }

  return 'muted';
}

function syncJobTone(status: KuaishouEcpmSyncJob['status']) {
  if (status === 'SUCCEEDED') {
    return 'success';
  }

  if (status === 'FAILED') {
    return 'danger';
  }

  return 'warning';
}

function closureStatusTone(status: BusinessClosureStatus) {
  if (status === 'READY') {
    return 'success';
  }

  if (status === 'BLOCKED') {
    return 'danger';
  }

  return 'warning';
}

function closureStatusLabel(status: BusinessClosureStatus) {
  if (status === 'READY') {
    return '已就绪';
  }

  if (status === 'BLOCKED') {
    return '阻塞';
  }

  return '需关注';
}

function formatTokenDate(value?: string | null) {
  if (!value) {
    return '-';
  }

  return value.replace('T', ' ').slice(0, 16);
}

const ecpmLookbackOptions: EcpmLookbackHours[] = [1, 3, 6, 12, 24];

function formatDateTime(value?: string | null) {
  if (!value) {
    return '-';
  }

  return value.replace('T', ' ').slice(0, 16);
}

function formatSyncRange(job: KuaishouEcpmSyncJob) {
  if (job.startedDataHour && job.endedDataHour) {
    return `${formatDateTime(job.startedDataHour)} - ${formatDateTime(
      job.endedDataHour,
    )}`;
  }

  return job.dataHour;
}

function parseEcpmLookback(value: string): EcpmLookbackHours {
  const parsed = Number(value) as EcpmLookbackHours;
  return ecpmLookbackOptions.includes(parsed) ? parsed : 3;
}

function formatCompanyAdminScopes(admin: AdminCompanyAdmin) {
  if (admin.scopes.length === 0) {
    return '未分配';
  }

  return admin.scopes
    .map((scope) => `${scope.companyId}: ${scope.gameIds.length} 个游戏`)
    .join(' / ');
}

export function OperationsWorkspace({
  adminAgents,
  adminCompanies,
  adminGames,
  adminName,
  adminWithdrawalStatus,
  adminWithdrawals,
  agentActionAgentId,
  agentAlipayAccount,
  agentAlipayRealName,
  agentWithdrawalAmountYuan,
  auditLogs,
  balanceAmountYuan,
  balanceCompanyId,
  balanceReason,
  budgetAmountYuan,
  budgetGameId,
  budgetReason,
  busyAction,
  businessClosure,
  companyAdmins,
  configBudgetAmountYuan,
  configBudgetReason,
  configEcpmLookbackHours,
  configGameDraft,
  configKuaishouEcpmJobs,
  configSection,
  ecpmJobs = [],
  ecpmRows = [],
  gameAppId,
  games,
  jsCode,
  isSuperAdmin,
  kuaishouAppId,
  kuaishouAuthCode,
  kuaishouEcpmJobs,
  kuaishouSecret,
  kuaishouTokenStatus,
  newAgentInvitationCode,
  newAgentParentId,
  newAgentPassword,
  newAgentUsername,
  newCompanyName,
  newGameAppId,
  newGameCompanyId,
  newGameName,
  newGameSecret,
  operationsOverview,
  platformConfig,
  platformConfigDraft,
  onAdjustCompanyBalance,
  onAllocateGameBudget,
  onApproveWithdrawal,
  onBalanceAmountChange,
  onBalanceCompanyIdChange,
  onBalanceReasonChange,
  onBudgetAmountChange,
  onBudgetGameIdChange,
  onBudgetReasonChange,
  onCloseGameConfig,
  onCloseWithdrawal,
  onConfirmSettlement,
  onConfigBudgetAmountChange,
  onConfigBudgetReasonChange,
  onConfigEcpmLookbackHoursChange,
  onConfigGameDraftChange,
  onConfigSectionChange,
  onAgentActionAgentIdChange,
  onAgentAlipayAccountChange,
  onAgentAlipayRealNameChange,
  onAgentWithdrawalAmountChange,
  onCreateAgent,
  onCreateCompany,
  onCreateCompanyAdmin,
  onCreateGame,
  onCreateSession,
  onEcpmDashboardQuery,
  onEcpmJobSelect,
  onEcpmUpdate,
  onGameChange,
  onJsCodeChange,
  onKuaishouAppIdChange,
  onKuaishouAuthCodeChange,
  onKuaishouAuthorize,
  onKuaishouRefreshToken,
  onKuaishouSecretChange,
  onLoadKuaishouEcpmJobs,
  onLoadKuaishouTokenStatus,
  onLoadAdminResources,
  onLoadAdminAgents,
  onLoadAuditLogs,
  onLoadBusinessClosure,
  onLoadCompanyAdmins,
  onLoadPlatformConfig,
  onLoadSettlementDetail,
  onLoadWithdrawalDetail,
  onLoadWithdrawals,
  onNewAgentInvitationCodeChange,
  onNewAgentParentIdChange,
  onNewAgentPasswordChange,
  onNewAgentUsernameChange,
  onNewCompanyNameChange,
  onNewGameAppIdChange,
  onNewGameCompanyIdChange,
  onNewGameNameChange,
  onNewGameSecretChange,
  onPayWithdrawal,
  onPlatformConfigDraftChange,
  onPreviewSettlement,
  onResetTestData,
  onOpenGameConfig,
  onRefreshConfigGameEcpm,
  onRefreshEcpm,
  onRetryKuaishouEcpmJob,
  onRequestAgentWithdrawal,
  onSaveGameConfig,
  onSavePlatformConfig,
  onSettlementEndDateChange,
  onSettlementStartDateChange,
  onSettlementUserIdChange,
  onSubmitConfigBudget,
  onUpdateAgentAlipay,
  onUpdateCompanyAdmin,
  onUpdateCompanyAdminScopes,
  refreshResult,
  sampleJsCodes,
  selectedConfigGame,
  selectedConfigGameId,
  selectedEcpmJob,
  selectedSettlementDetail,
  selectedGame,
  selectedWithdrawalDetail,
  settlementBatches,
  settlementEndDate,
  settlementPreview,
  settlementStartDate,
  settlementUserId,
  session,
}: OperationsWorkspaceProps) {
  const workspaceBusy = busyAction !== '';
  const kuaishouCallbackExample = getKuaishouCallbackExample();
  const canCreateCompany = newCompanyName.trim().length > 0;
  const canAdjustCompanyBalance =
    balanceCompanyId.trim().length > 0 && balanceAmountYuan.trim().length > 0;
  const canCreateGame =
    newGameCompanyId.trim().length > 0 &&
    newGameName.trim().length > 0 &&
    newGameAppId.trim().length > 0 &&
    newGameSecret.trim().length > 0;
  const canCreateAgent =
    newAgentUsername.trim().length > 0 &&
    newAgentInvitationCode.trim().length > 0 &&
    newAgentPassword.length >= 8;
  const canUpdateAgentAlipay =
    agentActionAgentId.trim().length > 0 &&
    agentAlipayAccount.trim().length > 0 &&
    agentAlipayRealName.trim().length > 0;
  const canRequestAgentWithdrawal =
    agentActionAgentId.trim().length > 0 &&
    agentWithdrawalAmountYuan.trim().length > 0;
  const canAllocateBudget =
    budgetGameId.trim().length > 0 && budgetAmountYuan.trim().length > 0;
  const canAllocateConfigBudget =
    Boolean(selectedConfigGame) && configBudgetAmountYuan.trim().length > 0;
  const canAuthorizeKuaishou =
    kuaishouAppId.trim().length > 0 &&
    kuaishouAuthCode.trim().length > 0 &&
    kuaishouSecret.trim().length > 0;
  const canRefreshKuaishouToken = Boolean(kuaishouTokenStatus?.configured);
  const settlementRatioTotal =
    parseDraftPercent(platformConfigDraft.userSettlementRatioPercent) +
    parseDraftPercent(platformConfigDraft.directAgentRatioPercent) +
    parseDraftPercent(platformConfigDraft.parentAgentRatioPercent) +
    parseDraftPercent(platformConfigDraft.defaultAgentRatioPercent) +
    parseDraftPercent(platformConfigDraft.feeRatioPercent);
  const canSavePlatformConfig =
    platformConfigDraft.displayRatioPercent.trim().length > 0 &&
    platformConfigDraft.minWithdrawalYuan.trim().length > 0 &&
    settlementRatioTotal === 100;
  const ecpmLoadingAction =
    busyAction === 'ecpm-dashboard' ||
    busyAction === 'ecpm-update' ||
    busyAction === 'ecpm-jobs'
      ? busyAction
      : '';
  const ecpmOperationsWiring =
    onEcpmDashboardQuery && onEcpmJobSelect && onEcpmUpdate
      ? {
          onDashboardQuery: onEcpmDashboardQuery,
          onJobSelect: onEcpmJobSelect,
          onUpdate: onEcpmUpdate,
        }
      : undefined;
  const canUpdateEcpm = ecpmOperationsWiring ? isSuperAdmin : false;
  const [activePane, setActivePane] = useState<OperationsPane>('overview');
  const [activeDialog, setActiveDialog] = useState<SuperAdminDialog>('');
  const [resetConfirmation, setResetConfirmation] = useState('');
  const [pendingWithdrawalAction, setPendingWithdrawalAction] =
    useState<PendingWithdrawalAction>();
  const [newCompanyAdminUsername, setNewCompanyAdminUsername] = useState('');
  const [newCompanyAdminDisplayName, setNewCompanyAdminDisplayName] =
    useState('');
  const [newCompanyAdminPassword, setNewCompanyAdminPassword] = useState('');
  const [newCompanyAdminEnabled, setNewCompanyAdminEnabled] = useState(true);
  const [selectedCompanyAdminId, setSelectedCompanyAdminId] = useState('');
  const [companyAdminEditDisplayName, setCompanyAdminEditDisplayName] =
    useState('');
  const [companyAdminEditPassword, setCompanyAdminEditPassword] = useState('');
  const [companyAdminEditEnabled, setCompanyAdminEditEnabled] = useState(true);
  const [companyAdminScopeDrafts, setCompanyAdminScopeDrafts] = useState<
    Array<{ companyId: string; gameIds: string[] }>
  >([]);
  const selectedCompanyAdmin = companyAdmins.find(
    (admin) => admin.id === selectedCompanyAdminId,
  );
  const canCreateCompanyAdmin =
    newCompanyAdminUsername.trim().length > 0 &&
    newCompanyAdminDisplayName.trim().length > 0 &&
    newCompanyAdminPassword.length >= 8;
  const canUpdateCompanyAdmin =
    Boolean(selectedCompanyAdmin) &&
    companyAdminEditDisplayName.trim().length > 0 &&
    (companyAdminEditPassword.length === 0 ||
      companyAdminEditPassword.length >= 8);
  const paneItems: Array<{
    description?: string;
    key: OperationsPane;
    label: string;
  }> = [
    { key: 'overview', label: '总览' },
    { description: '公司相关操作', key: 'company', label: '公司' },
    { description: '游戏相关操作', key: 'game', label: '游戏' },
    { description: '查询/更新/报告', key: 'ecpm', label: 'ECPM 看板' },
    { description: '授权/同步', key: 'kuaishou', label: '快手' },
    { key: 'settlement', label: '结算' },
    { key: 'withdrawal', label: '提现' },
    { key: 'audit', label: '审计' },
  ];
  if (isSuperAdmin) {
    paneItems.push({ description: '平台配置', key: 'config', label: '配置' });
    paneItems.push({ key: 'agents', label: '代理' });
    paneItems.push({ key: 'company-admins', label: '权限' });
    paneItems.push({
      description: '测试维护',
      key: 'maintenance',
      label: '维护',
    });
  }
  const paneClass = (pane: OperationsPane) =>
    activePane === pane ? 'operations-pane operations-pane-active' : 'operations-pane';

  function closeDialog() {
    setActiveDialog('');
    setResetConfirmation('');
  }

  function openCompanyAdminUpdateDialog(admin: AdminCompanyAdmin) {
    setSelectedCompanyAdminId(admin.id);
    setCompanyAdminEditDisplayName(admin.displayName);
    setCompanyAdminEditPassword('');
    setCompanyAdminEditEnabled(admin.enabled);
    setActiveDialog('update-company-admin');
  }

  function openCompanyAdminScopesDialog(admin: AdminCompanyAdmin) {
    setSelectedCompanyAdminId(admin.id);
    setCompanyAdminScopeDrafts(
      adminCompanies.map((company) => {
        const scope = admin.scopes.find(
          (currentScope) => currentScope.companyId === company.id,
        );

        return {
          companyId: company.id,
          gameIds: scope?.gameIds ?? [],
        };
      }),
    );
    setActiveDialog('company-admin-scopes');
  }

  function toggleCompanyAdminScopeGame(companyId: string, gameId: string) {
    setCompanyAdminScopeDrafts((current) =>
      current.map((scope) => {
        if (scope.companyId !== companyId) {
          return scope;
        }

        const gameIds = scope.gameIds.includes(gameId)
          ? scope.gameIds.filter((currentGameId) => currentGameId !== gameId)
          : [...scope.gameIds, gameId];

        return { ...scope, gameIds };
      }),
    );
  }

  function requestApproveWithdrawal(batchId: string) {
    if (!isSuperAdmin) {
      onApproveWithdrawal(batchId);
      return;
    }

    setPendingWithdrawalAction({ batchId, kind: 'approve' });
  }

  function requestCloseWithdrawal(batchId: string) {
    if (!isSuperAdmin) {
      onCloseWithdrawal(batchId);
      return;
    }

    setPendingWithdrawalAction({ batchId, kind: 'close' });
  }

  function requestPayWithdrawal(batchId: string, result: 'failed' | 'success') {
    if (!isSuperAdmin) {
      onPayWithdrawal(batchId, result);
      return;
    }

    setPendingWithdrawalAction({
      batchId,
      kind: result === 'success' ? 'pay-success' : 'pay-failed',
    });
  }

  function closeWithdrawalDialog() {
    setPendingWithdrawalAction(undefined);
  }

  function confirmWithdrawalAction() {
    if (!pendingWithdrawalAction) {
      return;
    }

    const action = pendingWithdrawalAction;
    setPendingWithdrawalAction(undefined);

    if (action.kind === 'approve') {
      onApproveWithdrawal(action.batchId);
      return;
    }

    if (action.kind === 'close') {
      onCloseWithdrawal(action.batchId);
      return;
    }

    onPayWithdrawal(
      action.batchId,
      action.kind === 'pay-success' ? 'success' : 'failed',
    );
  }

  useEffect(() => {
    if (selectedConfigGame) {
      setActivePane('game');
    }
  }, [selectedConfigGame]);

  useEffect(() => {
    if (selectedWithdrawalDetail) {
      setActivePane('withdrawal');
    }
  }, [selectedWithdrawalDetail]);

  const pendingWithdrawalSummary = pendingWithdrawalAction
    ? pendingWithdrawalAction.kind === 'approve'
      ? {
          confirmLabel: '确认通过审核',
          description: `将批次 ${pendingWithdrawalAction.batchId} 变更为已审核，后续可打款。`,
          title: '确认审核通过',
        }
      : pendingWithdrawalAction.kind === 'close'
        ? {
            confirmLabel: '确认关闭批次',
            description: `将关闭批次 ${pendingWithdrawalAction.batchId} 并执行冻结金额退回。`,
            title: '确认关闭提现批次',
          }
        : pendingWithdrawalAction.kind === 'pay-success'
          ? {
              confirmLabel: '确认打款成功',
              description: `将批次 ${pendingWithdrawalAction.batchId} 标记为打款成功并结束流程。`,
              title: '确认打款成功',
            }
          : {
              confirmLabel: '确认打款失败',
              description: `将批次 ${pendingWithdrawalAction.batchId} 标记为打款失败，后续可关闭并退回。`,
              title: '确认打款失败',
            }
    : undefined;

  return (
    <div className="operations-shell">
      <aside
        aria-label="运营功能栏"
        className="operations-feature-rail"
        title="运营功能栏"
      >
        <nav className="operations-feature-nav" aria-label="运营功能栏导航">
          {paneItems.map((item) => (
            <button
              aria-current={activePane === item.key ? 'page' : undefined}
              className="operations-feature-nav-item"
              key={item.key}
              onClick={() => setActivePane(item.key)}
              type="button"
            >
              <span className="operations-feature-nav-label">{item.label}</span>
              {item.description ? (
                <span className="operations-feature-nav-description">
                  {item.description}
                </span>
              ) : null}
            </button>
          ))}
        </nav>
      </aside>

      <div className="operations-workspace-body">

      {isSuperAdmin ? (
        <section className="super-admin-guide">
          <Panel
            description="主页面展示状态与结果，具体写操作统一在弹窗中执行并附带说明。"
            title="超级管理员操作说明"
          >
            <div className="workflow-grid">
              <article className="workflow-card">
                <h3>预算与组织</h3>
                <p>创建公司、创建游戏、充值公司余额、分配游戏预算。</p>
                <dl className="workflow-meta">
                  <dt>前置条件</dt>
                  <dd>已登录超级管理员，且资源关系已确认。</dd>
                </dl>
              </article>
              <article className="workflow-card">
                <h3>快手授权与同步</h3>
                <p>管理平台授权、token 刷新、同步任务排查。</p>
                <dl className="workflow-meta">
                  <dt>前置条件</dt>
                  <dd>已获取平台 app_id / secret / auth_code。</dd>
                </dl>
              </article>
              <article className="workflow-card">
                <h3>结算与提现</h3>
                <p>先预览结算结果，再确认入账；提现按状态逐批处理。</p>
                <dl className="workflow-meta">
                  <dt>前置条件</dt>
                  <dd>预算充足且同步数据完整。</dd>
                </dl>
              </article>
              <article className="workflow-card">
                <h3>测试环境维护</h3>
                <p>用于联调回滚，清空业务数据后重新开始整链路测试。</p>
                <dl className="workflow-meta">
                  <dt>前置条件</dt>
                  <dd>确认当前不需要保留任何测试记录。</dd>
                </dl>
              </article>
            </div>
          </Panel>
        </section>
      ) : null}

      <section className={paneClass('overview')}>
        <Panel
          description="预算、结算与同步异常聚合视图"
          title="运营总览"
        >
        <section className="metric-grid metric-grid-four" aria-label="运营总览指标">
          <MetricCard
            detail={operationsOverview.metrics.todayRevenue.detail}
            label={operationsOverview.metrics.todayRevenue.label}
            value={operationsOverview.metrics.todayRevenue.value}
          />
          <MetricCard
            detail={operationsOverview.metrics.budgetBalance.detail}
            label={operationsOverview.metrics.budgetBalance.label}
            value={operationsOverview.metrics.budgetBalance.value}
          />
          <MetricCard
            detail={operationsOverview.metrics.pendingSettlement.detail}
            label={operationsOverview.metrics.pendingSettlement.label}
            value={operationsOverview.metrics.pendingSettlement.value}
          />
          <MetricCard
            detail={operationsOverview.metrics.failedJobs.detail}
            label={operationsOverview.metrics.failedJobs.label}
            value={operationsOverview.metrics.failedJobs.value}
          />
        </section>
        <ReadoutGrid items={operationsOverview.summary} />
        {isSuperAdmin ? (
          <section className="overview-block" aria-label="真实数据闭环核对">
            <div className="inline-actions">
              <h3 className="overview-heading">真实数据闭环核对</h3>
              <StatusBadge tone="success">
                就绪 {businessClosure?.summary.ready ?? 0}
              </StatusBadge>
              <StatusBadge tone="warning">
                关注 {businessClosure?.summary.attention ?? 0}
              </StatusBadge>
              <StatusBadge tone="danger">
                阻塞 {businessClosure?.summary.blocked ?? 0}
              </StatusBadge>
              <Button
                disabled={workspaceBusy}
                icon={<RefreshCw size={14} />}
                onClick={onLoadBusinessClosure}
                variant="secondary"
              >
                {busyAction === 'business-closure' ? '刷新中' : '刷新核对'}
              </Button>
            </div>
            <p className="overview-empty">
              真实联调前逐项检查公司、游戏、预算、代理归属、open_id、ECPM、结算与提现证据。
            </p>
            {businessClosure ? (
              <div className="workflow-grid">
                {businessClosure.checks.map((check) => (
                  <article className="workflow-card" key={check.key}>
                    <div className="inline-actions">
                      <h3>{check.label}</h3>
                      <StatusBadge tone={closureStatusTone(check.status)}>
                        {closureStatusLabel(check.status)}
                      </StatusBadge>
                    </div>
                    <p>{check.description}</p>
                    <dl className="workflow-meta">
                      <dt>当前证据</dt>
                      {check.evidence.map((item) => (
                        <dd key={item}>{item}</dd>
                      ))}
                    </dl>
                  </article>
                ))}
              </div>
            ) : (
              <p className="overview-empty">
                暂无闭环核对数据，请点击“刷新核对”加载当前数据库状态。
              </p>
            )}
          </section>
        ) : null}
        <section className="overview-grid">
          <section className="overview-block" aria-label="游戏排行">
            <h3 className="overview-heading">游戏排行</h3>
            {operationsOverview.emptyStates.noRankings ? (
              <p className="overview-empty">
                暂无可用游戏排行，请先创建游戏并分配预算
              </p>
            ) : (
              <div className="data-table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>游戏</th>
                      <th>公司</th>
                      <th>预算</th>
                      <th>结算状态</th>
                    </tr>
                  </thead>
                  <tbody>
                    {operationsOverview.rankings.map((game) => (
                      <tr key={game.gameId}>
                        <td>{game.gameName}</td>
                        <td>{game.companyName}</td>
                        <td>{game.budget}</td>
                        <td>{game.settlementStatus}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
          <section className="overview-block" aria-label="异常摘要">
            <h3 className="overview-heading">异常摘要</h3>
            {operationsOverview.emptyStates.noExceptions ? (
              <p className="overview-empty">
                暂无异常任务，可点击“刷新任务”检查最新同步状态
              </p>
            ) : (
              <ul className="overview-exception-list">
                {operationsOverview.exceptions.map((exception) => (
                  <li className="overview-exception-item" key={exception.key}>
                    <strong>{exception.label}</strong>
                    <span>{exception.detail}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </section>
        </Panel>
      </section>

      <section className={paneClass('company')}>
        <Panel
          actions={
            <Button
              disabled={workspaceBusy}
              icon={<RefreshCw size={16} />}
              onClick={onLoadAdminResources}
              variant="secondary"
            >
              {busyAction === 'admin-resources' ? '加载中' : '刷新公司'}
            </Button>
          }
          description="公司主体与余额账户"
          title="公司管理"
        >
          <ReadoutGrid
            items={[
              { label: '公司数量', value: `${adminCompanies.length} 个` },
              { label: '游戏数量', value: `${adminGames.length} 个` },
            ]}
          />
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>公司</th>
                  <th>余额</th>
                </tr>
              </thead>
              <tbody>
                {adminCompanies.map((company) => (
                  <tr key={company.id}>
                    <td>{company.name}</td>
                    <td>{formatMoney(company.balance)}</td>
                  </tr>
                ))}
                {adminCompanies.length === 0 ? (
                  <tr>
                    <td colSpan={2}>暂无公司</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          {isSuperAdmin ? (
            <div className="workflow-grid">
              <article className="workflow-card">
                <h3>创建公司</h3>
                <p>新增运营公司主体，后续用于关联管理员、游戏与预算账户。</p>
                <dl className="workflow-meta">
                  <dt>执行结果</dt>
                  <dd>生成公司记录，显示在公司余额表。</dd>
                </dl>
                <Button
                  disabled={workspaceBusy}
                  onClick={() => setActiveDialog('create-company')}
                  variant="secondary"
                >
                  打开创建公司弹窗
                </Button>
              </article>
              <article className="workflow-card">
                <h3>公司余额充值</h3>
                <p>向公司主账户注入预算资金，作为后续游戏结算的资金来源。</p>
                <dl className="workflow-meta">
                  <dt>执行结果</dt>
                  <dd>公司余额增加并写入审计记录。</dd>
                </dl>
                <Button
                  disabled={workspaceBusy}
                  onClick={() => setActiveDialog('recharge-company')}
                  variant="secondary"
                >
                  打开充值弹窗
                </Button>
              </article>
            </div>
          ) : null}
        </Panel>
      </section>

      <section className={paneClass('game')}>
        <Panel
          actions={
            <Button
              disabled={workspaceBusy}
              icon={<RefreshCw size={16} />}
              onClick={onLoadAdminResources}
              variant="secondary"
            >
              {busyAction === 'admin-resources' ? '加载中' : '刷新游戏'}
            </Button>
          }
          description="游戏列表与预算"
          title="游戏管理"
        >
          <ReadoutGrid
            items={[
              { label: '游戏数量', value: `${adminGames.length} 个` },
              { label: '公司数量', value: `${adminCompanies.length} 个` },
            ]}
          />
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>游戏</th>
                  <th>公司</th>
                  <th>AppID</th>
                  <th>预算</th>
                  <th>状态</th>
                  {isSuperAdmin ? <th>操作</th> : null}
                </tr>
              </thead>
              <tbody>
                {adminGames.map((game) => (
                  <tr key={game.id}>
                    <td>{game.name}</td>
                    <td>{game.companyName}</td>
                    <td>{game.gameAppId}</td>
                    <td>{formatMoney(game.budget)}</td>
                    <td>
                      <StatusBadge
                        tone={game.settlementPaused ? 'warning' : 'success'}
                      >
                        {game.settlementPaused ? '已暂停' : '可结算'}
                      </StatusBadge>
                    </td>
                    {isSuperAdmin ? (
                      <td>
                        <Button
                          compact
                          disabled={workspaceBusy}
                          icon={<Settings size={14} />}
                          onClick={() => onOpenGameConfig(game.id)}
                          variant={
                            selectedConfigGameId === game.id
                              ? 'primary'
                              : 'secondary'
                          }
                        >
                          配置
                        </Button>
                      </td>
                    ) : null}
                  </tr>
                ))}
                {adminGames.length === 0 ? (
                  <tr>
                    <td colSpan={isSuperAdmin ? 6 : 5}>暂无游戏</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          {isSuperAdmin ? (
            <div className="workflow-grid">
              <article className="workflow-card">
                <h3>创建游戏</h3>
                <p>新增可联调的游戏配置，包含 game_app_id 与 game_secret。</p>
                <dl className="workflow-meta">
                  <dt>执行结果</dt>
                  <dd>游戏写入资源列表，可进入配置与结算流程。</dd>
                </dl>
                <Button
                  disabled={workspaceBusy}
                  onClick={() => setActiveDialog('create-game')}
                  variant="secondary"
                >
                  打开创建游戏弹窗
                </Button>
              </article>
              <article className="workflow-card">
                <h3>分配游戏预算</h3>
                <p>给单个游戏划拨可用预算；结算确认时将从该预算扣减。</p>
                <dl className="workflow-meta">
                  <dt>执行结果</dt>
                  <dd>目标游戏预算增加并写入预算流水。</dd>
                </dl>
                <Button
                  disabled={workspaceBusy}
                  onClick={() => setActiveDialog('allocate-budget')}
                  variant="secondary"
                >
                  打开预算分配弹窗
                </Button>
              </article>
            </div>
          ) : null}
        </Panel>

        {isSuperAdmin ? (
          <Panel
            description="联调页用于验证游戏登录换取 open_id 与 ECPM 明细写入链路。"
            title="联调操作说明"
          >
            <div className="workflow-grid">
              <article className="workflow-card">
                <h3>换取 open_id</h3>
                <p>输入 js_code 并选择游戏，调用 code2Session 生成可读 ID。</p>
                <dl className="workflow-meta">
                  <dt>按钮说明</dt>
                  <dd>“换取 open_id”：验证游戏登录链路是否可用。</dd>
                </dl>
              </article>
              <article className="workflow-card">
                <h3>刷新游戏 ECPM</h3>
                <p>按当前游戏触发 ECPM 拉取，检查写入数量与来源状态。</p>
                <dl className="workflow-meta">
                  <dt>按钮说明</dt>
                  <dd>“刷新游戏 ECPM”：手动触发一次同步检查。</dd>
                </dl>
              </article>
            </div>
          </Panel>
        ) : null}

        <section className="metric-grid" aria-label="联调状态">
          <MetricCard
            detail={gameAppId || '-'}
            label="测试游戏"
            value={selectedGame?.name ?? '-'}
          />
          <MetricCard
            detail={session?.openId ?? '等待游戏登录'}
            label="最新可读 ID"
            value={session?.readableId ?? '-'}
          />
          <MetricCard
            detail={`${refreshResult?.requestedOpenIds.length ?? 0} 个 open_id`}
            label="最近写入"
            value={`${refreshResult?.savedCount ?? 0} 条`}
          />
        </section>

        <section className="tool-grid">
          <Panel description="code2Session" title="游戏端登录">
            <div className="query-form">
              <label className="ui-input-field">
                <span className="ui-input-label">游戏</span>
                <span className="ui-input-control">
                  <select
                    disabled={workspaceBusy}
                    onChange={(event) => onGameChange(event.currentTarget.value)}
                    value={gameAppId}
                  >
                    {games.map((game) => (
                      <option key={game.gameAppId} value={game.gameAppId}>
                        {game.name} / {game.gameAppId}
                      </option>
                    ))}
                  </select>
                </span>
              </label>
              <InputField
                label="js_code"
                list="sample-js-codes"
                onChange={onJsCodeChange}
                value={jsCode}
              />
              <datalist id="sample-js-codes">
                {sampleJsCodes.map((code) => (
                  <option key={code} value={code} />
                ))}
              </datalist>
              <Button
                disabled={!gameAppId || !jsCode || workspaceBusy}
                icon={<Send size={16} />}
                onClick={onCreateSession}
              >
                {busyAction === 'session' ? '获取中' : '换取 open_id'}
              </Button>
            </div>
          </Panel>

          <Panel
            description={adminName ? `管理员 ${adminName}` : '管理员未登录'}
            title="快手 ECPM"
          >
            <div className="query-form">
              <ReadoutGrid
                items={[
                  { label: '游戏 AppID', value: gameAppId || '-' },
                  { label: '刷新来源', value: refreshResult?.source ?? '等待刷新' },
                ]}
              />
              <Button
                disabled={!gameAppId || workspaceBusy}
                icon={<RefreshCw size={16} />}
                onClick={onRefreshEcpm}
              >
                {busyAction === 'refresh' ? '刷新中' : '刷新游戏 ECPM'}
              </Button>
            </div>
          </Panel>

          <Panel description={session?.game.name ?? '未获取'} title="最新 open_id">
            <ReadoutGrid
              items={[
                { label: '可读 ID', value: session?.readableId ?? '-' },
                { label: 'open_id', value: session?.openId ?? '-' },
                { label: '写入明细', value: `${refreshResult?.savedCount ?? 0} 条` },
              ]}
            />
          </Panel>
        </section>

        <EcpmTable
          emptyLabel="暂无刷新明细"
          meta={`${refreshResult?.requestedOpenIds.length ?? 0} 个 open_id`}
          rows={refreshResult?.rows ?? []}
          title="刷新明细"
        />

        {isSuperAdmin && selectedConfigGame && configGameDraft ? (
          <GameConfigView
          budgetAmountYuan={configBudgetAmountYuan}
          budgetReason={configBudgetReason}
          busyAction={busyAction}
          canAllocateBudget={canAllocateConfigBudget}
          draft={configGameDraft}
          ecpmLookbackHours={configEcpmLookbackHours}
          game={selectedConfigGame}
          jobs={configKuaishouEcpmJobs}
          onBudgetAmountChange={onConfigBudgetAmountChange}
          onBudgetReasonChange={onConfigBudgetReasonChange}
          onClose={onCloseGameConfig}
          onDraftChange={onConfigGameDraftChange}
          onEcpmLookbackHoursChange={onConfigEcpmLookbackHoursChange}
          onRefreshEcpm={onRefreshConfigGameEcpm}
          onSave={onSaveGameConfig}
          onSectionChange={onConfigSectionChange}
          onSubmitBudget={onSubmitConfigBudget}
          section={configSection}
          workspaceBusy={workspaceBusy}
          />
        ) : null}
      </section>

      <section className={paneClass('ecpm')}>
        {ecpmOperationsWiring ? (
          <EcpmOperationsCenter
            canUpdate={canUpdateEcpm}
            companies={adminCompanies}
            games={adminGames}
            jobs={ecpmJobs}
            loadingAction={ecpmLoadingAction}
            onDashboardQuery={ecpmOperationsWiring.onDashboardQuery}
            onJobSelect={ecpmOperationsWiring.onJobSelect}
            onUpdate={ecpmOperationsWiring.onUpdate}
            rows={ecpmRows}
            selectedJob={selectedEcpmJob}
          />
        ) : (
          <Panel
            actions={<StatusBadge tone="muted">未接入</StatusBadge>}
            description="等待 Task 9 接入数据与操作回调"
            title="ECPM 看板等待接入"
          >
            <p className="overview-empty">
              当前仅保留一级入口，暂不展示查询、更新或任务按钮。
            </p>
          </Panel>
        )}
      </section>

      <section className={paneClass('kuaishou')}>
        <Panel
        actions={
          <Button
            disabled={workspaceBusy}
            icon={<RefreshCw size={16} />}
            onClick={onLoadKuaishouTokenStatus}
            variant="secondary"
          >
            {busyAction === 'kuaishou-token' ? '加载中' : '刷新状态'}
          </Button>
        }
        description={kuaishouTokenStatus?.source ?? 'none'}
        title="平台授权"
      >
        <div className="button-row">
          <StatusBadge tone={tokenStatusTone(kuaishouTokenStatus?.status)}>
            {kuaishouTokenStatus?.status ?? 'UNCONFIGURED'}
          </StatusBadge>
          {kuaishouTokenStatus?.lastError ? (
            <StatusBadge tone="danger">{kuaishouTokenStatus.lastError}</StatusBadge>
          ) : null}
        </div>
        <ReadoutGrid
          items={[
            {
              label: '平台 AppID',
              value: kuaishouTokenStatus?.appId ?? '-',
            },
            {
              label: '广告主',
              value: kuaishouTokenStatus?.advertiserId ?? '-',
            },
            {
              label: '来源',
              value: kuaishouTokenStatus?.source ?? 'none',
            },
            {
              label: '授权时间',
              value: formatTokenDate(kuaishouTokenStatus?.authorizedAt),
            },
            {
              label: 'access 过期',
              value: formatTokenDate(kuaishouTokenStatus?.accessTokenExpiresAt),
            },
            {
              label: 'refresh 过期',
              value: formatTokenDate(kuaishouTokenStatus?.refreshTokenExpiresAt),
            },
          ]}
        />
        {isSuperAdmin ? (
          <div className="workflow-card">
            <h3>授权与令牌维护</h3>
            <p>
              授权涉及平台凭证写入。建议先刷新状态确认是否已授权，再在弹窗内提交新授权。
            </p>
            <dl className="workflow-meta">
              <dt>执行结果</dt>
              <dd>成功后会更新 access/refresh 过期时间与广告主信息。</dd>
              <dt>授权回调地址</dt>
              <dd>
                <code className="inline-code">{kuaishouCallbackExample}</code>
              </dd>
            </dl>
            <p>
              快手回跳到本页时会自动读取 auth_code；确认 app_id 和 secret 后再提交授权。
            </p>
            <div className="button-row">
              <Button
                disabled={workspaceBusy}
                onClick={() => setActiveDialog('authorize-kuaishou')}
                variant="secondary"
              >
                打开授权弹窗
              </Button>
              <Button
                disabled={workspaceBusy || !canRefreshKuaishouToken}
                icon={<RefreshCw size={16} />}
                onClick={onKuaishouRefreshToken}
                variant="secondary"
              >
                {busyAction === 'kuaishou-refresh-token'
                  ? '刷新中'
                  : '直接刷新 token'}
              </Button>
            </div>
          </div>
        ) : null}
        </Panel>
      </section>

      <section className={paneClass('kuaishou')}>
        {isSuperAdmin ? (
          <Panel
            description="同步页用于排查快手任务执行结果、错误原因与数据覆盖范围。"
            title="同步任务说明"
          >
            <div className="workflow-grid">
              <article className="workflow-card">
                <h3>刷新任务</h3>
                <p>读取最新同步任务列表，按状态优先处理 FAILED 与 RETRYING。</p>
                <dl className="workflow-meta">
                  <dt>按钮说明</dt>
                  <dd>“刷新任务”：拉取最新任务状态快照。</dd>
                </dl>
              </article>
              <article className="workflow-card">
                <h3>排查字段</h3>
                <p>重点关注数据小时范围、open_id 数、写入条数、错误信息。</p>
                <dl className="workflow-meta">
                  <dt>执行建议</dt>
                  <dd>出现错误时先校验授权有效期，再回到授权页续期。</dd>
                </dl>
              </article>
            </div>
          </Panel>
        ) : null}

        <Panel
        actions={
          <Button
            disabled={workspaceBusy}
            icon={<RefreshCw size={16} />}
            onClick={onLoadKuaishouEcpmJobs}
            variant="secondary"
          >
            {busyAction === 'kuaishou-ecpm-jobs' ? '加载中' : '刷新任务'}
          </Button>
        }
        description="最近同步"
        title="同步任务"
      >
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>任务</th>
                <th>状态</th>
                <th>游戏</th>
                <th>数据小时</th>
                <th>open_id</th>
                <th>写入</th>
                <th>来源</th>
                <th>错误</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {kuaishouEcpmJobs.map((job) => (
                <tr key={job.id}>
                  <td>{job.id}</td>
                  <td>
                    <StatusBadge tone={syncJobTone(job.status)}>
                      {job.status}
                    </StatusBadge>
                  </td>
                  <td>{job.gameAppId}</td>
                  <td>{formatSyncRange(job)}</td>
                  <td>{job.requestedOpenIdCount}</td>
                  <td>{job.savedCount}</td>
                  <td>{job.source ?? '-'}</td>
                  <td>{job.errorMessage ?? '-'}</td>
                  <td>
                    {isSuperAdmin && job.status === 'FAILED' ? (
                      <Button
                        compact
                        disabled={workspaceBusy}
                        icon={<RefreshCw size={14} />}
                        onClick={() => onRetryKuaishouEcpmJob(job.id)}
                        variant="secondary"
                      >
                        {busyAction === `retry-ecpm-${job.id}`
                          ? '重试中'
                          : '重试失败任务'}
                      </Button>
                    ) : (
                      '-'
                    )}
                  </td>
                </tr>
              ))}
              {kuaishouEcpmJobs.length === 0 ? (
                <tr>
                  <td colSpan={9}>暂无同步任务</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        </Panel>
      </section>

      <section className={paneClass('settlement')}>
        <Panel description="按游戏和日期范围入账" title="结算确认">
        <div className="query-form">
          <InputField
            disabled={workspaceBusy}
            label="开始日期"
            onChange={onSettlementStartDateChange}
            type="date"
            value={settlementStartDate}
          />
          <InputField
            disabled={workspaceBusy}
            label="结束日期"
            onChange={onSettlementEndDateChange}
            type="date"
            value={settlementEndDate}
          />
          <InputField
            disabled={workspaceBusy}
            label="用户 ID"
            onChange={onSettlementUserIdChange}
            placeholder="可选"
            value={settlementUserId}
          />
          <div className="button-row">
            <Button
              disabled={!gameAppId || workspaceBusy}
              onClick={onPreviewSettlement}
              variant="secondary"
            >
              {busyAction === 'settlement-preview' ? '预览中' : '预览结算'}
            </Button>
            {isSuperAdmin ? (
              <Button
                disabled={
                  !gameAppId ||
                  workspaceBusy ||
                  !settlementPreview?.canConfirm ||
                  settlementPreview.settlementCount === 0
                }
                onClick={() => setActiveDialog('confirm-settlement')}
              >
                {busyAction === 'settlement-confirm'
                  ? '结算中'
                  : '打开确认弹窗'}
              </Button>
            ) : null}
          </div>
        </div>
        <ReadoutGrid
          items={[
            {
              label: '待结算金额',
              value: formatMoney(settlementPreview?.settlementAmount),
            },
            {
              label: '待结算记录',
              value: `${settlementPreview?.settlementCount ?? 0} 条`,
            },
            {
              label: '涉及用户',
              value: `${settlementPreview?.userCount ?? 0} 个`,
            },
            {
              label: '未绑定收益',
              value: `${settlementPreview?.unboundCount ?? 0} 条`,
            },
            {
              label: '当前预算',
              value: formatMoney(settlementPreview?.budgetBefore),
            },
            {
              label: '结算后预算',
              value: formatMoney(settlementPreview?.budgetAfter),
            },
          ]}
        />
        {settlementPreview && !settlementPreview.canConfirm ? (
          <StatusBadge tone="warning">预算不足或暂无可结算收益</StatusBadge>
        ) : null}
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>批次</th>
                <th>状态</th>
                <th>金额</th>
                <th>记录</th>
                <th>预算</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {settlementBatches.map((batch) => (
                <tr key={batch.id}>
                  <td>{batch.id}</td>
                  <td>{batch.status}</td>
                  <td>{formatMoney(batch.settledAmount)}</td>
                  <td>{batch.settledCount}</td>
                  <td>{formatMoney(batch.budgetAfter)}</td>
                  <td>
                    <Button
                      compact
                      disabled={workspaceBusy}
                      onClick={() => onLoadSettlementDetail(batch.id)}
                      variant="secondary"
                    >
                      {busyAction === `settlement-detail-${batch.id}`
                        ? '加载中'
                        : '查看明细'}
                    </Button>
                  </td>
                </tr>
              ))}
              {settlementBatches.length === 0 ? (
                <tr>
                  <td colSpan={6}>暂无结算批次</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        </Panel>
        {selectedSettlementDetail ? (
          <SettlementDetailPanel detail={selectedSettlementDetail} />
        ) : null}
      </section>

      <section className={paneClass('withdrawal')}>
        {isSuperAdmin ? (
          <Panel
            description="提现操作按批次推进：审核 -> 打款成功/失败 -> 失败批次关闭。"
            title="提现处理说明"
          >
            <div className="workflow-grid">
              <article className="workflow-card">
                <h3>状态筛选按钮</h3>
                <p>
                  “待审核”用于入口审批；“已审核”用于打款；“失败”用于关闭和退回。
                </p>
                <dl className="workflow-meta">
                  <dt>按钮说明</dt>
                  <dd>顶部三个筛选按钮只切换数据集，不修改业务状态。</dd>
                </dl>
              </article>
              <article className="workflow-card">
                <h3>批次动作按钮</h3>
                <p>详情/通过/打款/失败/关闭会改变状态，超级管理员下均弹窗二次确认。</p>
                <dl className="workflow-meta">
                  <dt>执行建议</dt>
                  <dd>打款前先核对收款人信息与金额，再执行状态变更。</dd>
                </dl>
              </article>
            </div>
          </Panel>
        ) : null}

        <Panel
        actions={
          <div className="button-row">
            <Button
              disabled={workspaceBusy}
              onClick={() => onLoadWithdrawals('PENDING_REVIEW')}
              variant="secondary"
            >
              待审核
            </Button>
            <Button
              disabled={workspaceBusy}
              onClick={() => onLoadWithdrawals('APPROVED')}
              variant="secondary"
            >
              已审核
            </Button>
            <Button
              disabled={workspaceBusy}
              onClick={() => onLoadWithdrawals('FAILED')}
              variant="secondary"
            >
              失败
            </Button>
          </div>
        }
        description={adminWithdrawalStatus}
        title="提现审核"
      >
        <WithdrawalBatchTable
          busyAction={busyAction}
          onApprove={requestApproveWithdrawal}
          onClose={requestCloseWithdrawal}
          onDetail={onLoadWithdrawalDetail}
          onPay={requestPayWithdrawal}
          rows={adminWithdrawals}
        />
        </Panel>

        {selectedWithdrawalDetail ? (
          <WithdrawalDetailPanel detail={selectedWithdrawalDetail} />
        ) : null}
      </section>

      <section className={paneClass('audit')}>
        {isSuperAdmin ? (
          <Panel
            description="审计日志记录关键管理动作，可用于回溯操作链路与责任人。"
            title="审计查看说明"
          >
            <div className="workflow-grid">
              <article className="workflow-card">
                <h3>刷新日志</h3>
                <p>每次执行关键写操作后刷新一次，确认日志已落库。</p>
                <dl className="workflow-meta">
                  <dt>按钮说明</dt>
                  <dd>“刷新日志”：拉取最新审计记录，不改变业务数据。</dd>
                </dl>
              </article>
              <article className="workflow-card">
                <h3>关键字段</h3>
                <p>优先查看动作、操作者、目标对象与元数据摘要是否符合预期。</p>
                <dl className="workflow-meta">
                  <dt>执行建议</dt>
                  <dd>联调问题排查时，把日志时间与任务/结算批次时间对齐。</dd>
                </dl>
              </article>
            </div>
          </Panel>
        ) : null}

        <Panel
        actions={
          <Button
            disabled={workspaceBusy}
            icon={<RefreshCw size={16} />}
            onClick={onLoadAuditLogs}
            variant="secondary"
          >
            {busyAction === 'audit-logs' ? '加载中' : '刷新日志'}
          </Button>
        }
        description="最近操作"
        title="审计日志"
      >
        <AuditLogTable rows={auditLogs} />
        </Panel>
      </section>

      {isSuperAdmin ? (
        <section className={paneClass('config')}>
          <Panel
            actions={
              <Button
                disabled={workspaceBusy}
                icon={<RefreshCw size={16} />}
                onClick={onLoadPlatformConfig}
                variant="secondary"
              >
                {busyAction === 'platform-config' ? '加载中' : '刷新配置'}
              </Button>
            }
            description="展示金额、结算分账与提现门槛"
            title="配置中心"
          >
            <div className="workflow-grid">
              <article className="workflow-card">
                <h3>平台业务配置</h3>
                <p>
                  配置会影响后续 ECPM 展示金额计算、结算入账拆分和提现门槛。
                </p>
                <dl className="workflow-meta">
                  <dt>生效范围</dt>
                  <dd>只影响保存后的新增同步和新增结算，历史批次按快照追溯。</dd>
                </dl>
              </article>
              <article className="workflow-card">
                <h3>分账合计</h3>
                <p>用户、直属代理、上级代理、默认代理、手续费五项必须合计 100%。</p>
                <dl className="workflow-meta">
                  <dt>当前合计</dt>
                  <dd>{settlementRatioTotal}%</dd>
                </dl>
              </article>
            </div>
            <ReadoutGrid
              items={[
                {
                  label: '当前展示金额比例',
                  value: `${platformConfig.displayRatioPercent}%`,
                },
                {
                  label: '当前用户结算比例',
                  value: `${platformConfig.userSettlementRatioPercent}%`,
                },
                {
                  label: '当前代理合计比例',
                  value: `${
                    platformConfig.directAgentRatioPercent +
                    platformConfig.parentAgentRatioPercent +
                    platformConfig.defaultAgentRatioPercent
                  }%`,
                },
                {
                  label: '当前手续费比例',
                  value: `${platformConfig.feeRatioPercent}%`,
                },
                {
                  label: '当前默认代理',
                  value: platformConfig.defaultAgentId ?? '未配置',
                },
                {
                  label: '当前最低提现金额',
                  value: formatMoney(platformConfig.minWithdrawal),
                },
              ]}
            />
            <div className="query-form">
              <InputField
                disabled={workspaceBusy}
                label="展示金额比例"
                onChange={(value) =>
                  onPlatformConfigDraftChange({ displayRatioPercent: value })
                }
                placeholder="例如 50"
                value={platformConfigDraft.displayRatioPercent}
              />
              <InputField
                disabled={workspaceBusy}
                label="用户结算比例"
                onChange={(value) =>
                  onPlatformConfigDraftChange({
                    userSettlementRatioPercent: value,
                  })
                }
                placeholder="例如 70"
                value={platformConfigDraft.userSettlementRatioPercent}
              />
              <InputField
                disabled={workspaceBusy}
                label="直属代理比例"
                onChange={(value) =>
                  onPlatformConfigDraftChange({
                    directAgentRatioPercent: value,
                  })
                }
                placeholder="例如 10"
                value={platformConfigDraft.directAgentRatioPercent}
              />
              <InputField
                disabled={workspaceBusy}
                label="上级代理比例"
                onChange={(value) =>
                  onPlatformConfigDraftChange({
                    parentAgentRatioPercent: value,
                  })
                }
                placeholder="例如 10"
                value={platformConfigDraft.parentAgentRatioPercent}
              />
              <InputField
                disabled={workspaceBusy}
                label="默认代理比例"
                onChange={(value) =>
                  onPlatformConfigDraftChange({
                    defaultAgentRatioPercent: value,
                  })
                }
                placeholder="例如 5"
                value={platformConfigDraft.defaultAgentRatioPercent}
              />
              <InputField
                disabled={workspaceBusy}
                label="手续费比例"
                onChange={(value) =>
                  onPlatformConfigDraftChange({ feeRatioPercent: value })
                }
                placeholder="例如 5"
                value={platformConfigDraft.feeRatioPercent}
              />
              <InputField
                disabled={workspaceBusy}
                label="默认代理 ID"
                onChange={(value) =>
                  onPlatformConfigDraftChange({ defaultAgentId: value })
                }
                placeholder="先在代理页创建并复制代理 ID"
                value={platformConfigDraft.defaultAgentId}
              />
              <InputField
                disabled={workspaceBusy}
                label="最低提现金额"
                onChange={(value) =>
                  onPlatformConfigDraftChange({ minWithdrawalYuan: value })
                }
                placeholder="例如 10.00"
                value={platformConfigDraft.minWithdrawalYuan}
              />
              <StatusBadge
                tone={settlementRatioTotal === 100 ? 'success' : 'warning'}
              >
                分账合计：{settlementRatioTotal}%
              </StatusBadge>
              <Button
                disabled={workspaceBusy || !canSavePlatformConfig}
                onClick={onSavePlatformConfig}
              >
                {busyAction === 'platform-config' ? '保存中' : '保存平台配置'}
              </Button>
            </div>
          </Panel>
        </section>
      ) : null}

      {isSuperAdmin ? (
        <section className={paneClass('agents')}>
          <Panel
            actions={
              <>
                <Button
                  disabled={workspaceBusy}
                  icon={<RefreshCw size={16} />}
                  onClick={onLoadAdminAgents}
                  variant="secondary"
                >
                  {busyAction === 'agents' ? '加载中' : '刷新代理'}
                </Button>
                <Button
                  disabled={workspaceBusy}
                  onClick={() => setActiveDialog('create-agent')}
                >
                  打开创建代理弹窗
                </Button>
              </>
            }
            description="创建代理账号，查看代理余额，并为配置中心提供默认代理 ID"
            title="代理管理"
          >
            <div className="workflow-grid">
              <article className="workflow-card">
                <h3>默认代理</h3>
                <p>
                  默认代理用于承接默认代理比例，以及用户缺少直属或上级代理时的代理份额。
                </p>
                <dl className="workflow-meta">
                  <dt>配置方式</dt>
                  <dd>先创建代理，再复制代理 ID 到“配置”页的默认代理 ID。</dd>
                </dl>
              </article>
              <article className="workflow-card">
                <h3>余额查看</h3>
                <p>确认结算后，直属代理、上级代理和默认代理金额会入账到代理可用余额。</p>
                <dl className="workflow-meta">
                  <dt>当前代理数</dt>
                  <dd>{adminAgents.length}</dd>
                </dl>
              </article>
            </div>
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>代理 ID</th>
                    <th>用户名</th>
                    <th>邀请码</th>
                    <th>上级代理</th>
                    <th>可用余额</th>
                    <th>冻结余额</th>
                    <th>状态</th>
                  </tr>
                </thead>
                <tbody>
                  {adminAgents.map((agent) => (
                    <tr key={agent.id}>
                      <td>{agent.id}</td>
                      <td>{agent.username}</td>
                      <td>{agent.invitationCode}</td>
                      <td>{agent.parentAgent?.username ?? '-'}</td>
                      <td>{formatMoney(agent.availableBalance)}</td>
                      <td>{formatMoney(agent.frozenBalance)}</td>
                      <td>
                        <StatusBadge tone={agent.enabled ? 'success' : 'muted'}>
                          {agent.enabled ? '启用' : '停用'}
                        </StatusBadge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {adminAgents.length === 0 ? (
                <p className="overview-empty">
                  暂无代理。创建一个代理后，可把它设置为默认代理。
                </p>
              ) : null}
            </div>
            <div className="query-form">
              <label className="ui-input-field">
                <span className="ui-input-label">操作代理</span>
                <span className="ui-input-control">
                  <select
                    disabled={workspaceBusy}
                    onChange={(event) =>
                      onAgentActionAgentIdChange(event.currentTarget.value)
                    }
                    value={agentActionAgentId}
                  >
                    <option value="">选择代理</option>
                    {adminAgents.map((agent) => (
                      <option key={agent.id} value={agent.id}>
                        {agent.username} / {agent.id}
                      </option>
                    ))}
                  </select>
                </span>
              </label>
              <InputField
                disabled={workspaceBusy}
                label="支付宝账号"
                onChange={onAgentAlipayAccountChange}
                placeholder="代理收款支付宝"
                value={agentAlipayAccount}
              />
              <InputField
                disabled={workspaceBusy}
                label="支付宝实名"
                onChange={onAgentAlipayRealNameChange}
                placeholder="代理收款实名"
                value={agentAlipayRealName}
              />
              <Button
                disabled={workspaceBusy || !canUpdateAgentAlipay}
                onClick={onUpdateAgentAlipay}
                variant="secondary"
              >
                {busyAction === 'agent-alipay' ? '保存中' : '保存代理支付宝'}
              </Button>
              <InputField
                disabled={workspaceBusy}
                label="提现金额"
                onChange={onAgentWithdrawalAmountChange}
                placeholder="例如 10.00"
                value={agentWithdrawalAmountYuan}
              />
              <Button
                disabled={workspaceBusy || !canRequestAgentWithdrawal}
                onClick={onRequestAgentWithdrawal}
              >
                {busyAction === 'agent-withdrawal' ? '提交中' : '提交代理提现'}
              </Button>
            </div>
          </Panel>
        </section>
      ) : null}

      {isSuperAdmin ? (
        <section className={paneClass('company-admins')}>
          <Panel
            actions={
              <Button
                disabled={workspaceBusy}
                icon={<RefreshCw size={16} />}
                onClick={onLoadCompanyAdmins}
                variant="secondary"
              >
                {busyAction === 'company-admins' ? '加载中' : '刷新账号'}
              </Button>
            }
            description="创建公司管理员账号，并为账号分配只读公司/游戏范围"
            title="公司管理员管理"
          >
            <div className="workflow-grid">
              <article className="workflow-card">
                <h3>账号管理</h3>
                <p>创建账号、更新显示名、启用/禁用账号或重置密码。</p>
                <dl className="workflow-meta">
                  <dt>权限边界</dt>
                  <dd>公司管理员当前仅开放只读权限。</dd>
                </dl>
                <Button
                  disabled={workspaceBusy}
                  onClick={() => setActiveDialog('create-company-admin')}
                  variant="secondary"
                >
                  打开创建账号弹窗
                </Button>
              </article>
              <article className="workflow-card">
                <h3>授权范围</h3>
                <p>按公司分组勾选可查看的游戏，保存后替换该账号的全部范围。</p>
                <dl className="workflow-meta">
                  <dt>执行结果</dt>
                  <dd>只影响公司管理员可见数据，不开放写操作。</dd>
                </dl>
              </article>
            </div>
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>用户名</th>
                    <th>显示名</th>
                    <th>状态</th>
                    <th>授权范围</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {companyAdmins.map((admin) => (
                    <tr key={admin.id}>
                      <td>{admin.username}</td>
                      <td>{admin.displayName}</td>
                      <td>
                        <StatusBadge tone={admin.enabled ? 'success' : 'muted'}>
                          {admin.enabled ? '已启用' : '已禁用'}
                        </StatusBadge>
                      </td>
                      <td>{formatCompanyAdminScopes(admin)}</td>
                      <td>
                        <span className="inline-actions">
                          <Button
                            compact
                            disabled={workspaceBusy}
                            onClick={() => openCompanyAdminUpdateDialog(admin)}
                            variant="secondary"
                          >
                            编辑账号
                          </Button>
                          <Button
                            compact
                            disabled={workspaceBusy}
                            onClick={() => openCompanyAdminScopesDialog(admin)}
                            variant="secondary"
                          >
                            分配范围
                          </Button>
                        </span>
                      </td>
                    </tr>
                  ))}
                  {companyAdmins.length === 0 ? (
                    <tr>
                      <td colSpan={5}>暂无公司管理员账号</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </Panel>
        </section>
      ) : null}

      {isSuperAdmin ? (
        <section className={paneClass('maintenance')}>
          <Panel
            description="用于联调回滚：清空业务数据并保留超级管理员登录能力"
            title="测试数据维护"
          >
            <div className="workflow-card">
              <h3>一键清空测试数据</h3>
              <p>
                删除联调过程产生的业务数据（公司、游戏、账户、配置、提现、结算、平台授权与审计日志）。
              </p>
              <dl className="workflow-meta">
                <dt>风险提示</dt>
                <dd>清空后不可恢复，建议在新一轮联调开始前执行。</dd>
              </dl>
              <Button
                disabled={workspaceBusy}
                icon={<ShieldAlert size={16} />}
                onClick={() => setActiveDialog('reset-test-data')}
                variant="danger"
              >
                {busyAction === 'reset-test-data' ? '清空中' : '打开清空弹窗'}
              </Button>
            </div>
          </Panel>
        </section>
      ) : null}

      <Dialog
        description="创建后可关联公司管理员、游戏及预算。"
        footer={
          <>
            <Button onClick={closeDialog} variant="ghost">
              取消
            </Button>
            <Button
              disabled={workspaceBusy || !canCreateCompany}
              onClick={onCreateCompany}
            >
              {busyAction === 'company-create' ? '创建中' : '确认创建'}
            </Button>
          </>
        }
        onClose={closeDialog}
        open={isSuperAdmin && activeDialog === 'create-company'}
        title="创建公司"
      >
        <InputField
          disabled={workspaceBusy}
          label="公司名称"
          onChange={onNewCompanyNameChange}
          placeholder="例如：华东运营中心"
          value={newCompanyName}
        />
        <p className="field-help">公司名称用于预算归属与权限范围展示。</p>
      </Dialog>

      <Dialog
        description="向公司主账户充值预算，后续可分配给具体游戏。"
        footer={
          <>
            <Button onClick={closeDialog} variant="ghost">
              取消
            </Button>
            <Button
              disabled={workspaceBusy || !canAdjustCompanyBalance}
              onClick={onAdjustCompanyBalance}
            >
              {busyAction === 'company-balance' ? '提交中' : '确认充值'}
            </Button>
          </>
        }
        onClose={closeDialog}
        open={isSuperAdmin && activeDialog === 'recharge-company'}
        title="公司余额充值"
      >
        <label className="ui-input-field">
          <span className="ui-input-label">充值公司</span>
          <span className="ui-input-control">
            <select
              disabled={workspaceBusy}
              onChange={(event) => onBalanceCompanyIdChange(event.currentTarget.value)}
              value={balanceCompanyId}
            >
              <option value="">选择公司</option>
              {adminCompanies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </select>
          </span>
        </label>
        <InputField
          disabled={workspaceBusy}
          label="充值金额（元）"
          onChange={onBalanceAmountChange}
          placeholder="例如 100.00"
          value={balanceAmountYuan}
        />
        <InputField
          disabled={workspaceBusy}
          label="充值原因（可选）"
          onChange={onBalanceReasonChange}
          placeholder="例如：联调预算补充"
          value={balanceReason}
        />
      </Dialog>

      <Dialog
        description="新增游戏后，游戏方可进行 code2Session 联调与收益入账。"
        footer={
          <>
            <Button onClick={closeDialog} variant="ghost">
              取消
            </Button>
            <Button disabled={workspaceBusy || !canCreateGame} onClick={onCreateGame}>
              {busyAction === 'game-create' ? '创建中' : '确认创建'}
            </Button>
          </>
        }
        onClose={closeDialog}
        open={isSuperAdmin && activeDialog === 'create-game'}
        title="创建游戏"
      >
        <label className="ui-input-field">
          <span className="ui-input-label">所属公司</span>
          <span className="ui-input-control">
            <select
              disabled={workspaceBusy}
              onChange={(event) =>
                onNewGameCompanyIdChange(event.currentTarget.value)
              }
              value={newGameCompanyId}
            >
              <option value="">选择公司</option>
              {adminCompanies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </select>
          </span>
        </label>
        <InputField
          disabled={workspaceBusy}
          label="游戏名称"
          onChange={onNewGameNameChange}
          value={newGameName}
        />
        <InputField
          disabled={workspaceBusy}
          label="game_app_id"
          onChange={onNewGameAppIdChange}
          value={newGameAppId}
        />
        <InputField
          disabled={workspaceBusy}
          label="game_secret"
          onChange={onNewGameSecretChange}
          value={newGameSecret}
        />
      </Dialog>

      <Dialog
        description="预算分配后可进入结算预览与确认，建议每次分配都填写原因。"
        footer={
          <>
            <Button onClick={closeDialog} variant="ghost">
              取消
            </Button>
            <Button
              disabled={workspaceBusy || !canAllocateBudget}
              onClick={onAllocateGameBudget}
            >
              {busyAction === 'game-budget' ? '提交中' : '确认分配'}
            </Button>
          </>
        }
        onClose={closeDialog}
        open={isSuperAdmin && activeDialog === 'allocate-budget'}
        title="分配游戏预算"
      >
        <label className="ui-input-field">
          <span className="ui-input-label">预算游戏</span>
          <span className="ui-input-control">
            <select
              disabled={workspaceBusy}
              onChange={(event) => onBudgetGameIdChange(event.currentTarget.value)}
              value={budgetGameId}
            >
              <option value="">选择游戏</option>
              {adminGames.map((game) => (
                <option key={game.id} value={game.id}>
                  {game.name}
                </option>
              ))}
            </select>
          </span>
        </label>
        <InputField
          disabled={workspaceBusy}
          label="分配金额（元）"
          onChange={onBudgetAmountChange}
          placeholder="例如 50.00"
          value={budgetAmountYuan}
        />
        <InputField
          disabled={workspaceBusy}
          label="分配原因（可选）"
          onChange={onBudgetReasonChange}
          placeholder="例如：测试结算入账"
          value={budgetReason}
        />
      </Dialog>

      <Dialog
        description="提交授权后将立即覆盖当前平台凭证；请确保 app_id 与 auth_code 来自同一授权周期。"
        footer={
          <>
            <Button onClick={closeDialog} variant="ghost">
              取消
            </Button>
            <Button
              disabled={workspaceBusy || !canAuthorizeKuaishou}
              icon={<KeyRound size={16} />}
              onClick={onKuaishouAuthorize}
            >
              {busyAction === 'kuaishou-authorize' ? '提交中' : '提交授权'}
            </Button>
          </>
        }
        onClose={closeDialog}
        open={isSuperAdmin && activeDialog === 'authorize-kuaishou'}
        title="快手平台授权"
      >
        <InputField
          disabled={workspaceBusy}
          label="平台 app_id"
          onChange={onKuaishouAppIdChange}
          value={kuaishouAppId}
        />
        <InputField
          disabled={workspaceBusy}
          label="secret"
          onChange={onKuaishouSecretChange}
          type="password"
          value={kuaishouSecret}
        />
        <InputField
          disabled={workspaceBusy}
          label="auth_code"
          onChange={onKuaishouAuthCodeChange}
          value={kuaishouAuthCode}
        />
        <p className="field-help">
          如果仅需续期，请在“平台授权”页面直接点击“直接刷新 token”。
        </p>
      </Dialog>

      <Dialog
        description="该操作会按当前预览结果入账并生成结算批次，请在确认前核对金额与记录数。"
        footer={
          <>
            <Button onClick={closeDialog} variant="ghost">
              取消
            </Button>
            <Button
              disabled={
                !gameAppId ||
                workspaceBusy ||
                !settlementPreview?.canConfirm ||
                settlementPreview.settlementCount === 0
              }
              onClick={onConfirmSettlement}
            >
              {busyAction === 'settlement-confirm' ? '结算中' : '确认入账'}
            </Button>
          </>
        }
        onClose={closeDialog}
        open={isSuperAdmin && activeDialog === 'confirm-settlement'}
        title="结算确认弹窗"
      >
        <ReadoutGrid
          items={[
            {
              label: '待结算金额',
              value: formatMoney(settlementPreview?.settlementAmount),
            },
            {
              label: '待结算记录',
              value: `${settlementPreview?.settlementCount ?? 0} 条`,
            },
            {
              label: '涉及用户',
              value: `${settlementPreview?.userCount ?? 0} 个`,
            },
            {
              label: '结算后预算',
              value: formatMoney(settlementPreview?.budgetAfter),
            },
          ]}
        />
        {settlementPreview && !settlementPreview.canConfirm ? (
          <StatusBadge tone="warning">预算不足或暂无可结算收益</StatusBadge>
        ) : null}
      </Dialog>

      <Dialog
        description={pendingWithdrawalSummary?.description}
        footer={
          <>
            <Button onClick={closeWithdrawalDialog} variant="ghost">
              取消
            </Button>
            <Button
              disabled={workspaceBusy || !pendingWithdrawalAction}
              onClick={confirmWithdrawalAction}
            >
              {pendingWithdrawalSummary?.confirmLabel ?? '确认执行'}
            </Button>
          </>
        }
        onClose={closeWithdrawalDialog}
        open={isSuperAdmin && Boolean(pendingWithdrawalAction)}
        title={pendingWithdrawalSummary?.title ?? '确认操作'}
      >
        <StatusBadge tone="warning">
          该操作会写入审计日志并影响提现状态，请确认批次号与执行意图一致
        </StatusBadge>
        {pendingWithdrawalAction ? (
          <ReadoutGrid
            items={[
              { label: '批次号', value: pendingWithdrawalAction.batchId },
              {
                label: '操作类型',
                value:
                  pendingWithdrawalAction.kind === 'approve'
                    ? '审核通过'
                    : pendingWithdrawalAction.kind === 'close'
                      ? '关闭批次'
                      : pendingWithdrawalAction.kind === 'pay-success'
                        ? '打款成功'
                        : '打款失败',
              },
            ]}
          />
        ) : null}
      </Dialog>

      <Dialog
        description="创建后可作为用户直属代理、上级代理，或填入配置中心作为默认代理。"
        footer={
          <>
            <Button onClick={closeDialog} variant="ghost">
              取消
            </Button>
            <Button
              disabled={workspaceBusy || !canCreateAgent}
              onClick={onCreateAgent}
            >
              {busyAction === 'agent-create' ? '创建中' : '确认创建'}
            </Button>
          </>
        }
        onClose={closeDialog}
        open={isSuperAdmin && activeDialog === 'create-agent'}
        title="创建代理"
      >
        <InputField
          disabled={workspaceBusy}
          label="代理用户名"
          onChange={onNewAgentUsernameChange}
          placeholder="例如 default_agent"
          value={newAgentUsername}
        />
        <InputField
          disabled={workspaceBusy}
          label="初始密码"
          onChange={onNewAgentPasswordChange}
          placeholder="至少 8 位"
          type="password"
          value={newAgentPassword}
        />
        <InputField
          disabled={workspaceBusy}
          label="邀请码"
          onChange={onNewAgentInvitationCodeChange}
          placeholder="例如 DEFAULT_AGENT"
          value={newAgentInvitationCode}
        />
        <InputField
          disabled={workspaceBusy}
          label="上级代理 ID"
          onChange={onNewAgentParentIdChange}
          placeholder="可选，二级代理时填写"
          value={newAgentParentId}
        />
        <p className="field-help">
          如果要配置默认代理，创建成功后复制列表里的代理 ID 到“配置”页。
        </p>
      </Dialog>

      <Dialog
        description="创建后账号可从管理员登录入口进入运营台，初始只拥有分配范围内的只读能力。"
        footer={
          <>
            <Button onClick={closeDialog} variant="ghost">
              取消
            </Button>
            <Button
              disabled={workspaceBusy || !canCreateCompanyAdmin}
              onClick={() =>
                onCreateCompanyAdmin({
                  displayName: newCompanyAdminDisplayName.trim(),
                  enabled: newCompanyAdminEnabled,
                  password: newCompanyAdminPassword,
                  username: newCompanyAdminUsername.trim(),
                })
              }
            >
              {busyAction === 'company-admin-create' ? '创建中' : '确认创建'}
            </Button>
          </>
        }
        onClose={closeDialog}
        open={isSuperAdmin && activeDialog === 'create-company-admin'}
        title="创建公司管理员"
      >
        <InputField
          disabled={workspaceBusy}
          label="用户名"
          onChange={setNewCompanyAdminUsername}
          value={newCompanyAdminUsername}
        />
        <InputField
          disabled={workspaceBusy}
          label="显示名"
          onChange={setNewCompanyAdminDisplayName}
          value={newCompanyAdminDisplayName}
        />
        <InputField
          disabled={workspaceBusy}
          label="初始密码"
          onChange={setNewCompanyAdminPassword}
          type="password"
          value={newCompanyAdminPassword}
        />
        <p className="field-help">
          密码至少 8 位；账号创建后再通过“分配范围”授予可见游戏。
        </p>
        <label className="setting-toggle">
          <input
            checked={newCompanyAdminEnabled}
            disabled={workspaceBusy}
            onChange={(event) =>
              setNewCompanyAdminEnabled(event.currentTarget.checked)
            }
            type="checkbox"
          />
          <span>创建后立即启用</span>
        </label>
      </Dialog>

      <Dialog
        description="更新账号基础信息。密码留空时不会重置密码。"
        footer={
          <>
            <Button onClick={closeDialog} variant="ghost">
              取消
            </Button>
            <Button
              disabled={workspaceBusy || !canUpdateCompanyAdmin}
              onClick={() =>
                selectedCompanyAdmin
                  ? onUpdateCompanyAdmin(selectedCompanyAdmin.id, {
                      displayName: companyAdminEditDisplayName.trim(),
                      enabled: companyAdminEditEnabled,
                      ...(companyAdminEditPassword
                        ? { password: companyAdminEditPassword }
                        : {}),
                    })
                  : undefined
              }
            >
              {busyAction === 'company-admin-update' ? '保存中' : '保存账号'}
            </Button>
          </>
        }
        onClose={closeDialog}
        open={isSuperAdmin && activeDialog === 'update-company-admin'}
        title="编辑公司管理员账号"
      >
        <ReadoutGrid
          items={[
            { label: '用户名', value: selectedCompanyAdmin?.username ?? '-' },
            { label: '账号 ID', value: selectedCompanyAdmin?.id ?? '-' },
          ]}
        />
        <InputField
          disabled={workspaceBusy}
          label="显示名"
          onChange={setCompanyAdminEditDisplayName}
          value={companyAdminEditDisplayName}
        />
        <InputField
          disabled={workspaceBusy}
          label="重置密码（可选）"
          onChange={setCompanyAdminEditPassword}
          type="password"
          value={companyAdminEditPassword}
        />
        <p className="field-help">填写新密码时至少 8 位；留空表示保持原密码。</p>
        <label className="setting-toggle">
          <input
            checked={companyAdminEditEnabled}
            disabled={workspaceBusy}
            onChange={(event) =>
              setCompanyAdminEditEnabled(event.currentTarget.checked)
            }
            type="checkbox"
          />
          <span>启用账号</span>
        </label>
      </Dialog>

      <Dialog
        description="保存后会替换该账号当前全部授权范围，未勾选的游戏将不可见。"
        footer={
          <>
            <Button onClick={closeDialog} variant="ghost">
              取消
            </Button>
            <Button
              disabled={workspaceBusy || !selectedCompanyAdmin}
              onClick={() =>
                selectedCompanyAdmin
                  ? onUpdateCompanyAdminScopes(selectedCompanyAdmin.id, {
                      scopes: companyAdminScopeDrafts
                        .filter((scope) => scope.gameIds.length > 0)
                        .map((scope) => ({
                          companyId: scope.companyId,
                          gameIds: scope.gameIds,
                        })),
                    })
                  : undefined
              }
            >
              {busyAction === 'company-admin-scopes'
                ? '保存中'
                : '保存授权范围'}
            </Button>
          </>
        }
        onClose={closeDialog}
        open={isSuperAdmin && activeDialog === 'company-admin-scopes'}
        title="分配公司管理员范围"
      >
        <ReadoutGrid
          items={[
            { label: '用户名', value: selectedCompanyAdmin?.username ?? '-' },
            {
              label: '显示名',
              value: selectedCompanyAdmin?.displayName ?? '-',
            },
          ]}
        />
        <div className="workflow-grid">
          {adminCompanies.map((company) => {
            const companyGames = adminGames.filter(
              (game) => game.companyId === company.id,
            );
            const scope = companyAdminScopeDrafts.find(
              (draft) => draft.companyId === company.id,
            );

            return (
              <article className="workflow-card" key={company.id}>
                <h3>{company.name}</h3>
                <p>{companyGames.length} 个可授权游戏</p>
                {companyGames.length === 0 ? (
                  <p className="field-help">该公司暂无游戏。</p>
                ) : null}
                {companyGames.map((game) => (
                  <label className="setting-toggle" key={game.id}>
                    <input
                      checked={scope?.gameIds.includes(game.id) ?? false}
                      disabled={workspaceBusy}
                      onChange={() =>
                        toggleCompanyAdminScopeGame(company.id, game.id)
                      }
                      type="checkbox"
                    />
                    <span>
                      {game.name} / {game.gameAppId}
                    </span>
                  </label>
                ))}
              </article>
            );
          })}
          {adminCompanies.length === 0 ? (
            <p className="overview-empty">暂无公司，请先创建公司和游戏。</p>
          ) : null}
        </div>
      </Dialog>

      <Dialog
        description="仅建议在联调重置时执行。输入确认口令后才能触发清空。"
        footer={
          <>
            <Button onClick={closeDialog} variant="ghost">
              取消
            </Button>
            <Button
              disabled={
                workspaceBusy || resetConfirmation.trim() !== 'RESET_TEST_DATA'
              }
              icon={<ShieldAlert size={16} />}
              onClick={onResetTestData}
              variant="danger"
            >
              {busyAction === 'reset-test-data' ? '清空中' : '确认清空'}
            </Button>
          </>
        }
        onClose={closeDialog}
        open={isSuperAdmin && activeDialog === 'reset-test-data'}
        title="清空测试数据"
      >
        <StatusBadge tone="danger">
          将删除公司、游戏、用户、平台配置、预算、提现、结算、平台授权、同步任务和审计日志
        </StatusBadge>
        <InputField
          disabled={workspaceBusy}
          label="确认口令"
          onChange={setResetConfirmation}
          placeholder="输入 RESET_TEST_DATA"
          value={resetConfirmation}
        />
        <p className="field-help">
          执行后仅保留超级管理员登录能力；业务数据不可恢复。
        </p>
      </Dialog>
      </div>
    </div>
  );
}

function GameConfigView({
  budgetAmountYuan,
  budgetReason,
  busyAction,
  canAllocateBudget,
  draft,
  ecpmLookbackHours,
  game,
  jobs,
  onBudgetAmountChange,
  onBudgetReasonChange,
  onClose,
  onDraftChange,
  onEcpmLookbackHoursChange,
  onRefreshEcpm,
  onSave,
  onSectionChange,
  onSubmitBudget,
  section,
  workspaceBusy,
}: {
  budgetAmountYuan: string;
  budgetReason: string;
  busyAction: OperationsWorkspaceBusyAction;
  canAllocateBudget: boolean;
  draft: GameConfigDraft;
  ecpmLookbackHours: EcpmLookbackHours;
  game: AdminGame;
  jobs: KuaishouEcpmSyncJob[];
  onBudgetAmountChange(value: string): void;
  onBudgetReasonChange(value: string): void;
  onClose(): void;
  onDraftChange(patch: Partial<GameConfigDraft>): void;
  onEcpmLookbackHoursChange(value: EcpmLookbackHours): void;
  onRefreshEcpm(): void;
  onSave(): void;
  onSectionChange(section: GameConfigSection): void;
  onSubmitBudget(): void;
  section: GameConfigSection;
  workspaceBusy: boolean;
}) {
  const gameJobs = jobs.filter((job) => job.gameAppId === game.gameAppId);
  const sections: Array<{ key: GameConfigSection; label: string }> = [
    { key: 'basic', label: '基础信息' },
    { key: 'budget', label: '预算与结算' },
    { key: 'ecpm', label: 'ECPM 同步' },
    { key: 'audit', label: '审计/任务历史' },
  ];

  return (
    <Panel
      actions={
        <Button
          compact
          disabled={workspaceBusy}
          icon={<X size={14} />}
          onClick={onClose}
          variant="ghost"
        >
          关闭
        </Button>
      }
      description={`${game.name} / ${game.gameAppId}`}
      title="游戏配置"
    >
      <div className="game-config-shell">
        <nav className="game-config-nav" aria-label="游戏配置模块">
          {sections.map((item) => (
            <button
              aria-current={section === item.key ? 'page' : undefined}
              className="game-config-nav-item"
              disabled={workspaceBusy}
              key={item.key}
              onClick={() => onSectionChange(item.key)}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </nav>
        <div className="game-config-content">
          {section === 'basic' ? (
            <section className="game-config-section">
              <div className="section-copy">
                <h3>基础信息</h3>
                <p>修改游戏展示名称和 game_secret，保存后会影响后续游戏端登录校验。</p>
              </div>
              <ReadoutGrid
                items={[
                  { label: 'game_app_id', value: game.gameAppId },
                  { label: '所属公司', value: game.companyName },
                ]}
              />
              <div className="query-form">
                <InputField
                  disabled={workspaceBusy}
                  label="游戏名称"
                  onChange={(value) => onDraftChange({ name: value })}
                  value={draft.name}
                />
                <InputField
                  disabled={workspaceBusy}
                  label="game_secret"
                  onChange={(value) => onDraftChange({ gameSecret: value })}
                  value={draft.gameSecret}
                />
                <Button disabled={workspaceBusy} onClick={onSave}>
                  {busyAction === 'game-config' ? '保存中' : '保存基础信息'}
                </Button>
              </div>
            </section>
          ) : null}

          {section === 'budget' ? (
            <section className="game-config-section">
              <div className="section-copy">
                <h3>预算与结算</h3>
                <p>预算用于结算扣减；暂停结算后，该游戏不会进入管理员确认结算流程。</p>
              </div>
              <ReadoutGrid
                items={[
                  { label: '当前预算', value: formatMoney(game.budget) },
                  { label: '所属公司', value: game.companyName },
                  {
                    label: '结算状态',
                    value: draft.settlementPaused ? '已暂停' : '可结算',
                  },
                ]}
              />
              <label className="setting-toggle">
                <input
                  checked={draft.settlementPaused}
                  disabled={workspaceBusy}
                  onChange={(event) =>
                    onDraftChange({
                      settlementPaused: event.currentTarget.checked,
                    })
                  }
                  type="checkbox"
                />
                <span>暂停结算</span>
              </label>
              <div className="query-form">
                <InputField
                  disabled={workspaceBusy}
                  label="分配金额"
                  onChange={onBudgetAmountChange}
                  placeholder="例如 50.00"
                  value={budgetAmountYuan}
                />
                <InputField
                  disabled={workspaceBusy}
                  label="分配原因"
                  onChange={onBudgetReasonChange}
                  placeholder="可选"
                  value={budgetReason}
                />
                <Button
                  disabled={workspaceBusy || !canAllocateBudget}
                  onClick={onSubmitBudget}
                  variant="secondary"
                >
                  {busyAction === 'game-config-budget'
                    ? '提交中'
                    : '分配预算'}
                </Button>
                <Button disabled={workspaceBusy} onClick={onSave}>
                  {busyAction === 'game-config' ? '保存中' : '保存结算配置'}
                </Button>
              </div>
            </section>
          ) : null}

          {section === 'ecpm' ? (
            <section className="game-config-section">
              <div className="section-copy">
                <h3>ECPM 同步</h3>
                <p>
                  自动同步默认关闭，只有管理员启用后才会运行。默认频率为 3 小时，
                  只能选择 1/3/6/12/24 小时。
                </p>
                <p>
                  自动同步使用配置频率对应的准确时间窗口，不会扩大到任意更长范围；
                  失败不会自动重试，需要管理员手动处理。
                </p>
                <p>手动刷新可选择回看 1/3/6/12/24 小时。</p>
              </div>
              <div className="button-row">
                <StatusBadge tone={draft.ecpmAutoSyncEnabled ? 'success' : 'muted'}>
                  {draft.ecpmAutoSyncEnabled ? '自动同步已启用' : '默认关闭'}
                </StatusBadge>
                <StatusBadge tone="warning">失败不会自动重试</StatusBadge>
              </div>
              <ReadoutGrid
                items={[
                  { label: '默认频率', value: '3 小时' },
                  {
                    label: '配置频率',
                    value: `${draft.ecpmAutoSyncIntervalHours} 小时`,
                  },
                  {
                    label: '上次运行',
                    value: formatDateTime(game.ecpmAutoSyncLastRunAt),
                  },
                  {
                    label: '下次运行',
                    value: formatDateTime(game.ecpmAutoSyncNextRunAt),
                  },
                ]}
              />
              <div className="query-form">
                <label className="setting-toggle">
                  <input
                    checked={draft.ecpmAutoSyncEnabled}
                    disabled={workspaceBusy}
                    onChange={(event) =>
                      onDraftChange({
                        ecpmAutoSyncEnabled: event.currentTarget.checked,
                      })
                    }
                    type="checkbox"
                  />
                  <span>启用自动同步</span>
                </label>
                <label className="ui-input-field">
                  <span className="ui-input-label">自动同步频率</span>
                  <span className="ui-input-control">
                    <select
                      disabled={workspaceBusy}
                      onChange={(event) =>
                        onDraftChange({
                          ecpmAutoSyncIntervalHours: parseEcpmLookback(
                            event.currentTarget.value,
                          ),
                        })
                      }
                      value={draft.ecpmAutoSyncIntervalHours}
                    >
                      {ecpmLookbackOptions.map((option) => (
                        <option key={option} value={option}>
                          {option} 小时
                        </option>
                      ))}
                    </select>
                  </span>
                </label>
                <Button disabled={workspaceBusy} onClick={onSave}>
                  {busyAction === 'game-config' ? '保存中' : '保存同步配置'}
                </Button>
              </div>
              <div className="query-form">
                <label className="ui-input-field">
                  <span className="ui-input-label">手动回看范围</span>
                  <span className="ui-input-control">
                    <select
                      disabled={workspaceBusy}
                      onChange={(event) =>
                        onEcpmLookbackHoursChange(
                          parseEcpmLookback(event.currentTarget.value),
                        )
                      }
                      value={ecpmLookbackHours}
                    >
                      {ecpmLookbackOptions.map((option) => (
                        <option key={option} value={option}>
                          {option} 小时
                        </option>
                      ))}
                    </select>
                  </span>
                </label>
                <Button
                  disabled={workspaceBusy}
                  icon={<RefreshCw size={16} />}
                  onClick={onRefreshEcpm}
                  variant="secondary"
                >
                  {busyAction === 'game-config-ecpm-refresh'
                    ? '刷新中'
                    : '手动刷新 ECPM'}
                </Button>
              </div>
            </section>
          ) : null}

          {section === 'audit' ? (
            <section className="game-config-section">
              <div className="section-copy">
                <h3>审计/任务历史</h3>
                <p>展示当前游戏的 ECPM 同步任务，优先使用任务返回的开始和结束数据小时。</p>
              </div>
              <div className="data-table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>任务</th>
                      <th>状态</th>
                      <th>同步范围</th>
                      <th>open_id</th>
                      <th>写入</th>
                      <th>错误</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gameJobs.map((job) => (
                      <tr key={job.id}>
                        <td>{job.id}</td>
                        <td>
                          <StatusBadge tone={syncJobTone(job.status)}>
                            {job.status}
                          </StatusBadge>
                        </td>
                        <td>{formatSyncRange(job)}</td>
                        <td>{job.requestedOpenIdCount}</td>
                        <td>{job.savedCount}</td>
                        <td>{job.errorMessage ?? '-'}</td>
                      </tr>
                    ))}
                    {gameJobs.length === 0 ? (
                      <tr>
                        <td colSpan={6}>暂无该游戏同步任务</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </Panel>
  );
}

function getKuaishouCallbackExample() {
  if (typeof window === 'undefined') {
    return '/?auth_code=AUTH_CODE&app_id=APP_ID';
  }

  return `${window.location.origin}${window.location.pathname}?auth_code=AUTH_CODE&app_id=APP_ID`;
}

function parseDraftPercent(value: string) {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : 0;
}

function SettlementDetailPanel({
  detail,
}: {
  detail: AdminSettlementDetailResult;
}) {
  return (
    <Panel description={detail.batch.id} title="结算明细">
      <ReadoutGrid
        items={[
          { label: '结算总额', value: formatMoney(detail.batch.settledAmount) },
          { label: '结算记录', value: `${detail.batch.settledCount} 条` },
          { label: '涉及用户', value: `${detail.batch.userCount} 个` },
          { label: '预算扣减后', value: formatMoney(detail.batch.budgetAfter) },
        ]}
      />
      <div className="data-table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>open_id</th>
              <th>用户</th>
              <th>直属代理</th>
              <th>上级代理</th>
              <th>用户金额</th>
              <th>直属代理金额</th>
              <th>上级代理金额</th>
              <th>默认代理金额</th>
              <th>手续费</th>
              <th>结算总额</th>
            </tr>
          </thead>
          <tbody>
            {detail.items.map((item) => (
              <tr key={item.id}>
                <td>{item.openId}</td>
                <td>{item.userId}</td>
                <td>{item.directAgentId ?? '-'}</td>
                <td>{item.parentAgentId ?? '-'}</td>
                <td>{formatMoney(item.userAmount)}</td>
                <td>{formatMoney(item.directAgentAmount)}</td>
                <td>{formatMoney(item.parentAgentAmount)}</td>
                <td>{formatMoney(item.defaultAgentAmount)}</td>
                <td>{formatMoney(item.feeAmount)}</td>
                <td>{formatMoney(item.settlementAmount)}</td>
              </tr>
            ))}
            {detail.items.length === 0 ? (
              <tr>
                <td colSpan={10}>暂无结算明细</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function WithdrawalDetailPanel({
  detail,
}: {
  detail: AdminWithdrawalDetailResult;
}) {
  return (
    <Panel
      actions={
        <StatusBadge tone={statusTone(detail.batch.status)}>
          {detail.batch.status}
        </StatusBadge>
      }
      description={detail.batch.id}
      title="提现详情"
    >
      <ReadoutGrid
        items={[
          {
            label: '归属',
            value:
              detail.batch.ownerType === 'AGENT'
                ? `代理 ${detail.batch.ownerId ?? '-'}`
                : `用户 ${detail.batch.userId ?? detail.batch.ownerId ?? '-'}`,
          },
          { label: '金额', value: formatMoney(detail.batch.totalAmount) },
          { label: '审计', value: `${detail.auditLogs.length} 条` },
        ]}
      />
      <div className="data-table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>明细</th>
              <th>状态</th>
              <th>收款人</th>
              <th>错误</th>
              <th>响应</th>
            </tr>
          </thead>
          <tbody>
            {detail.batch.details.map((row) => (
              <tr key={row.type}>
                <td>{row.type}</td>
                <td>{row.status}</td>
                <td>{row.recipientName}</td>
                <td>{row.errorCode ?? '-'}</td>
                <td>{formatAuditMetadata(row.alipayResponseSnapshot)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
