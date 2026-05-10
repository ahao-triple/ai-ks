export type MoneyValue = {
  li: string;
  yuan: string;
};

export type IntegrationStatus = {
  kuaishouApiMode: 'real' | 'unconfigured';
  requiredForRealMode: {
    kuaishouAccessToken: boolean;
    kuaishouAdvertiserId: boolean;
  };
};

export type KuaishouTokenStatusResult = {
  accessTokenExpiresAt: string | null;
  advertiserId: string | null;
  appId: string | null;
  authorizedAt: string | null;
  configured: boolean;
  lastError: string | null;
  refreshTokenExpiresAt: string | null;
  refreshedAt: string | null;
  source: 'database' | 'env' | 'none';
  status: 'ACTIVE' | 'ERROR' | 'EXPIRED' | 'UNCONFIGURED';
};

export type GameSessionResult = {
  game: {
    gameAppId: string;
    name: string;
  };
  openId: string;
  readableId: string;
};

export type EcpmRow = {
  displayAmount: MoneyValue;
  eventTime: string;
  gameAppId: string;
  openId: string;
  platformEventId: string;
  rawCost: MoneyValue;
};

export type EcpmLookbackHours = 1 | 3 | 6 | 12 | 24;

export type KuaishouEcpmSyncJob = {
  actorId: string;
  actorType: string;
  createdAt: string;
  dataHour: string;
  endedDataHour: string | null;
  errorMessage: string | null;
  finishedAt: string | null;
  gameAppId: string;
  id: string;
  lookbackHours: number | null;
  requestedOpenIdCount: number;
  savedCount: number;
  source: 'kuaishou' | null;
  startedAt: string;
  startedDataHour: string | null;
  status: 'FAILED' | 'RUNNING' | 'SUCCEEDED';
  updatedAt: string;
};

export type KuaishouEcpmSyncJobListResult = {
  jobs: KuaishouEcpmSyncJob[];
};

export type EcpmRefreshResult = {
  job: KuaishouEcpmSyncJob;
  requestedOpenIds: string[];
  rows: EcpmRow[];
  savedCount: number;
  source: 'kuaishou';
};

export type EcpmDashboardScope =
  | 'company'
  | 'game'
  | 'latest'
  | 'open_id'
  | 'user';
export type EcpmUpdateScopeType = 'company' | 'game' | 'open_id' | 'user';
export type EcpmUpdateMode = 'latest' | 'range';
export type EcpmUpdateJobStatus =
  | 'FAILED'
  | 'PARTIAL'
  | 'RUNNING'
  | 'SUCCEEDED';

export type EcpmDashboardRow = {
  companyId?: string;
  companyName?: string;
  configSnapshot?: unknown;
  createdAt?: string;
  dataHour: string;
  displayAmount: MoneyValue;
  eventCount?: number;
  eventTime?: string;
  gameAppId: string;
  gameId: string;
  gameName: string;
  id?: string;
  openId?: string;
  openIdCount?: number;
  openIdRecordId?: string | null;
  platformEventId?: string;
  rawCost: MoneyValue;
  readableId?: string | null;
  status?: string;
  updatedAt?: string | null;
  userId?: string | null;
  userReadableId?: string | null;
  username?: string | null;
};

export type EcpmDashboardResult = {
  openId?: string;
  openIds?: string[];
  rows: EcpmDashboardRow[];
  scope: EcpmDashboardScope;
  userId?: string;
};

export type EcpmUpdateRequest = {
  endedDataHour?: string | null;
  mode: EcpmUpdateMode;
  scopeId: string;
  scopeType: EcpmUpdateScopeType;
  startedDataHour?: string | null;
};

export type EcpmUpdateJobItem = {
  createdAt: string;
  dataHour: string;
  errorMessage: string | null;
  gameAppId: string | null;
  gameId: string | null;
  id: string;
  jobId: string;
  kuaishouSyncJobId: string | null;
  openId: string | null;
  savedCount: number;
  skipReason: string | null;
  status: EcpmUpdateJobStatus;
  updatedAt: string;
  userId: string | null;
};

export type EcpmUpdateJob = {
  actorId: string;
  actorType: string;
  createdAt: string;
  endedDataHour: string;
  errorMessage: string | null;
  failedCount: number;
  finishedAt: string | null;
  id: string;
  itemCount?: number;
  items?: EcpmUpdateJobItem[];
  mode: EcpmUpdateMode;
  requestCount?: number | null;
  requestedGameCount: number;
  requestedOpenIdCount: number;
  savedCount: number;
  scopeId: string;
  scopeType: EcpmUpdateScopeType;
  source?: 'kuaishou' | null;
  skippedCount: number;
  startedAt: string;
  startedDataHour: string;
  status: EcpmUpdateJobStatus;
  updatedAt: string;
};

export type EcpmUpdateJobListResult = {
  jobs: EcpmUpdateJob[];
};

export type EarningsResult = {
  date: string;
  identity: string;
  openId: string;
  readableId?: string;
  rows: EcpmRow[];
  totalDisplayAmount: MoneyValue;
  totalRawCost: MoneyValue;
};

export type AccountResult = {
  id: string;
  readableId: string;
  username: string;
};

export type AuthResult = {
  accessToken: string;
  account: AccountResult;
};

export type AccountAgentBinding = {
  id: string;
  invitationCode: string;
  parentAgentId: string | null;
  username: string;
};

export type AccountAgentBindingResult = {
  agent: AccountAgentBinding | null;
};

export type SuperAdminPrincipal = {
  role: 'SUPER_ADMIN';
  username: string;
};

export type CompanyAdminPrincipal = {
  adminId: string;
  displayName: string;
  role: 'COMPANY_ADMIN';
  username: string;
};

export type AdminPrincipal = CompanyAdminPrincipal | SuperAdminPrincipal;

export type AdminAuthResult = {
  accessToken: string;
  admin: AdminPrincipal;
};

export type AgentPrincipal = {
  id: string;
  invitationCode: string;
  username: string;
};

export type AgentAuthResult = {
  accessToken: string;
  agent: AgentPrincipal;
};

export type CurrentAdminResult = {
  admin: AdminPrincipal;
};

export type AdminCompany = {
  balance: MoneyValue;
  createdAt: string;
  id: string;
  name: string;
  updatedAt: string;
};

export type AdminCompanyListResult = {
  companies: AdminCompany[];
};

export type AdminGame = {
  budget: MoneyValue;
  companyId: string;
  companyName: string;
  createdAt: string;
  ecpmAutoSyncEnabled: boolean;
  ecpmAutoSyncIntervalHours: EcpmLookbackHours;
  ecpmAutoSyncLastRunAt: string | null;
  ecpmAutoSyncNextRunAt: string | null;
  gameAppId: string;
  gameSecret: string;
  id: string;
  name: string;
  settlementPaused: boolean;
  updatedAt: string;
};

export type AdminGameListResult = {
  games: AdminGame[];
};

export type AdminGameBudgetAllocationResult = {
  company: AdminCompany;
  game: AdminGame;
};

export type AdminCompanyAdminScope = {
  companyId: string;
  gameIds: string[];
  operationCodes: string[];
};

export type AdminCompanyAdmin = {
  createdAt: string;
  deletedAt: string | null;
  displayName: string;
  enabled: boolean;
  id: string;
  scopes: AdminCompanyAdminScope[];
  updatedAt: string;
  username: string;
};

export type AdminCompanyAdminListResult = {
  admins: AdminCompanyAdmin[];
};

export type AdminCompanyAdminResult = {
  admin: AdminCompanyAdmin;
};

export type AdminAgent = {
  alipayAccount: string | null;
  alipayRealName: string | null;
  availableBalance: MoneyValue;
  createdAt: string;
  enabled: boolean;
  frozenBalance: MoneyValue;
  id: string;
  invitationCode: string;
  parentAgent: {
    id: string;
    invitationCode: string;
    username: string;
  } | null;
  parentAgentId: string | null;
  username: string;
};

export type AdminAgentListResult = {
  agents: AdminAgent[];
};

export type AdminAgentResult = {
  agent: AdminAgent;
};

export type PlatformConfig = {
  defaultAgentId: string | null;
  defaultAgentRatioPercent: number;
  directAgentRatioPercent: number;
  displayRatioPercent: number;
  feeRatioPercent: number;
  minWithdrawal: MoneyValue;
  parentAgentRatioPercent: number;
  userSettlementRatioPercent: number;
};

export type PlatformConfigUpdateInput = {
  defaultAgentId: string | null;
  defaultAgentRatioPercent: number;
  directAgentRatioPercent: number;
  displayRatioPercent: number;
  feeRatioPercent: number;
  minWithdrawalYuan: string;
  parentAgentRatioPercent: number;
  userSettlementRatioPercent: number;
};

export type AccountEarningsResult = {
  date: string;
  openIds: string[];
  rows: EcpmRow[];
  totalDisplayAmount: MoneyValue;
  totalRawCost: MoneyValue;
  userId: string;
};

export type AlipayProfile = {
  alipayAccount: string | null;
  alipayRealName: string | null;
};

export type WithdrawalResult = {
  details: Array<{
    amount: MoneyValue;
    alipayRequestSnapshot?: unknown;
    alipayResponseSnapshot?: unknown;
    errorCode?: string | null;
    errorMessage?: string | null;
    recipientAlipay: string;
    recipientName: string;
    status: string;
    type: string;
  }>;
  id: string;
  status: string;
  totalAmount: MoneyValue;
};

export type AdminWithdrawalBatch = WithdrawalResult & {
  createdAt: string;
  ownerId: string | null;
  ownerType: 'AGENT' | 'USER' | 'COMPANY_ADMIN' | 'SUPER_ADMIN';
  updatedAt: string;
  userId: string | null;
};

export type AdminWithdrawalListResult = {
  batches: AdminWithdrawalBatch[];
};

export type AgentProfile = AgentPrincipal & {
  alipayAccount: string | null;
  alipayRealName: string | null;
  availableBalance: MoneyValue;
  frozenBalance: MoneyValue;
};

export type AgentEarningRole =
  | 'DEFAULT_AGENT'
  | 'DIRECT_AGENT'
  | 'PARENT_AGENT';

export type AgentEarningRow = {
  amount: MoneyValue;
  batchId: string;
  createdAt: string;
  id: string;
  itemId: string;
  openId: string;
  rawEcpmId: string;
  role: AgentEarningRole;
  settlementAmount: MoneyValue;
  userId: string;
};

export type AgentEarningsResult = {
  rows: AgentEarningRow[];
  totalAmount: MoneyValue;
};

export type AgentUserRow = {
  createdAt: string;
  currentAgentId: string;
  currentAgentInvitationCode: string;
  currentAgentUsername: string;
  id: string;
  readableId: string;
  relation: 'CHILD_AGENT' | 'DIRECT';
  username: string;
};

export type AgentUsersResult = {
  rows: AgentUserRow[];
  totalCount: number;
};

export type AgentWithdrawalListResult = {
  batches: AdminWithdrawalBatch[];
};

export type AuditLogRow = {
  action: string;
  actorId: string;
  actorType: string;
  createdAt: string;
  id: string;
  metadata: unknown;
  targetId: string;
  targetType: string;
};

export type AuditLogListResult = {
  logs: AuditLogRow[];
};

export type AdminWithdrawalDetailResult = {
  auditLogs: AuditLogRow[];
  batch: AdminWithdrawalBatch;
};

export type AdminSettlementRange = {
  endDate: string;
  gameId: string;
  startDate: string;
  userId?: string;
};

export type AdminSettlementPreview = {
  budgetAfter: MoneyValue;
  budgetBefore: MoneyValue;
  canConfirm: boolean;
  companyId: string;
  gameId: string;
  settlementAmount: MoneyValue;
  settlementCount: number;
  unboundCount: number;
  userCount: number;
};

export type AdminSettlementItem = {
  createdAt: string;
  defaultAgentAmount: MoneyValue;
  defaultAgentId: string | null;
  directAgentAmount: MoneyValue;
  directAgentId: string | null;
  displayAmount: MoneyValue;
  feeAmount: MoneyValue;
  gameOpenIdId: string;
  id: string;
  openId: string;
  parentAgentAmount: MoneyValue;
  parentAgentId: string | null;
  rawEcpmId: string;
  settlementAmount: MoneyValue;
  splitSnapshot: unknown;
  userAmount: MoneyValue;
  userId: string;
};

export type AdminSettlementBatch = {
  budgetAfter: MoneyValue;
  budgetBefore: MoneyValue;
  companyId: string;
  configSnapshot: unknown;
  createdAt: string;
  endedAt: string;
  gameId: string;
  id: string;
  operatorId: string;
  operatorType: string;
  settledAmount: MoneyValue;
  settledCount: number;
  startedAt: string;
  status: string;
  userCount: number;
};

export type AdminSettlementConfirmResult = {
  batch: AdminSettlementBatch;
  items: AdminSettlementItem[];
};

export type AdminSettlementListResult = {
  batches: AdminSettlementBatch[];
};

export type AdminSettlementDetailResult = {
  batch: AdminSettlementBatch;
  items: AdminSettlementItem[];
};

export type BusinessClosureStatus = 'ATTENTION' | 'BLOCKED' | 'READY';

export type BusinessClosureCheck = {
  description: string;
  evidence: string[];
  key:
    | 'agents'
    | 'ecpm'
    | 'open_ids'
    | 'resources'
    | 'settlement'
    | 'user_agent_binding'
    | 'withdrawal';
  label: string;
  status: BusinessClosureStatus;
};

export type BusinessClosureReport = {
  checks: BusinessClosureCheck[];
  metrics: {
    activeAgentCount: number;
    boundOpenIdCount: number;
    boundUserCount: number;
    companyCount: number;
    gameBudgetLi: string;
    gameCount: number;
    openIdCount: number;
    pendingEcpmCount: number;
    rawEcpmCount: number;
    settlementBatchCount: number;
    userCount: number;
    withdrawalBatchCount: number;
  };
  summary: {
    attention: number;
    blocked: number;
    ready: number;
  };
};

export type UserDashboardOverview = {
  todayCount: number;
  todayAverageEcpmYuan: number;
  todayMaxEcpmYuan: number;
  gameCount: number;
  accountCount: number;
  activeGameCount: number;
  activeAccountCount: number;
};

export type UserDashboardAccountActiveStatus = 'ACTIVE' | 'IDLE' | 'NEVER';

export type UserDashboardAccountRow = {
  accountId: string;
  readableId: string;
  todayCount: number;
  todayAverageEcpmYuan: number;
  totalCount: number;
  lastActiveAt: string | null;
  activeStatus: UserDashboardAccountActiveStatus;
};

export type UserDashboardGameGroup = {
  gameId: string;
  gameName: string;
  todayCount: number;
  todayAverageEcpmYuan: number;
  totalCount: number;
  lastActiveAt: string | null;
  accounts: UserDashboardAccountRow[];
};

export type UserDashboardEcpmRecord = {
  id: string;
  todaySequence: number;
  eventTime: string;
  ecpmYuan: number;
  gameId: string;
  gameName: string;
  accountId: string;
  accountReadableId: string;
  source: string;
};

export type UserDashboardEcpmRecordsResult = {
  records: UserDashboardEcpmRecord[];
  totalToday: number;
  totalAll: number;
};

export type SuperAdminOverview = {
  todayCount: number;
  todayAverageEcpmYuan: number;
  todayMaxEcpmYuan: number;
  activeGameCount: number;
  totalGameCount: number;
  activeUserCount: number;
};

export type SuperAdminCompanyRow = {
  companyId: string;
  companyName: string;
  ecpmCount: number;
  activeGameCount: number;
  totalGameCount: number;
  activeUserCount: number;
  averageEcpmYuan: number;
  maxEcpmYuan: number;
};

export type AgentDashboardOverview = {
  invitationCode: string;
  directUserCount: number;
  todayTotalAmountYuan: number;
  myShareTodayYuan: number;
};

export type AgentDashboardUserRow = {
  userId: string;
  readableId: string;
  todayAmountYuan: number;
  todayEcpmCount: number;
  totalAmountYuan: number;
  registeredAt: string;
  lastActiveAt: string | null;
};

export type SuperAdminAnomalies = {
  syncFailures: Array<{
    gameAppId: string;
    gameName: string;
    jobId: string;
    failedAt: string;
    errorMessage: string | null;
  }>;
  longSilent: Array<{
    gameId: string;
    gameName: string;
    hoursSinceLastEcpm: number;
  }>;
};
