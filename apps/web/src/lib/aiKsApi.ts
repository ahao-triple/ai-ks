import { requestJson } from './api';
import type {
  AccountAgentBindingResult,
  AccountEarningsResult,
  AccountResult,
  AdminAgentListResult,
  AdminAgentResult,
  AdminAuthResult,
  AdminCompany,
  AdminCompanyAdminListResult,
  AdminCompanyAdminResult,
  AdminCompanyListResult,
  AdminGame,
  AdminGameBudgetAllocationResult,
  AdminGameListResult,
  AdminSettlementConfirmResult,
  AdminSettlementDetailResult,
  AdminSettlementListResult,
  AdminSettlementPreview,
  AdminSettlementRange,
  AdminWithdrawalBatch,
  AdminWithdrawalDetailResult,
  AdminWithdrawalListResult,
  AgentAuthResult,
  AgentEarningsResult,
  AgentProfile,
  AgentUsersResult,
  AgentWithdrawalListResult,
  AlipayProfile,
  AuditLogListResult,
  AuthResult,
  BusinessClosureReport,
  CurrentAdminResult,
  EcpmDashboardResult,
  EcpmDashboardScope,
  EarningsResult,
  EcpmLookbackHours,
  EcpmRefreshResult,
  EcpmUpdateJob,
  EcpmUpdateJobListResult,
  EcpmUpdateRequest,
  GameSessionResult,
  IntegrationStatus,
  KuaishouEcpmSyncJobListResult,
  KuaishouTokenStatusResult,
  PlatformConfig,
  PlatformConfigUpdateInput,
  SuperAdminAnomalies,
  SuperAdminCompanyRow,
  SuperAdminOverview,
  UserDashboardEcpmRecordsResult,
  UserDashboardGameGroup,
  UserDashboardOverview,
  WithdrawalResult,
} from '../types/api';

function withdrawalPath(batchId: string, suffix = '') {
  return `/admin/withdrawals/${encodeURIComponent(batchId)}${suffix}`;
}

function companyPath(companyId: string, suffix = '') {
  return `/admin/companies/${encodeURIComponent(companyId)}${suffix}`;
}

function companyAdminPath(adminId: string, suffix = '') {
  return `/admin/company-admins/${encodeURIComponent(adminId)}${suffix}`;
}

function agentPath(agentId: string, suffix = '') {
  return `/admin/agents/${encodeURIComponent(agentId)}${suffix}`;
}

function gamePath(gameId: string, suffix = '') {
  return `/admin/games/${encodeURIComponent(gameId)}${suffix}`;
}

function kuaishouEcpmJobPath(jobId: string, suffix = '') {
  return `/admin/kuaishou/ecpm/jobs/${encodeURIComponent(jobId)}${suffix}`;
}

function ecpmUpdateJobPath(jobId: string, suffix = '') {
  return `/admin/ecpm/update-jobs/${encodeURIComponent(jobId)}${suffix}`;
}

function settlementQuery(range: AdminSettlementRange) {
  const query = new URLSearchParams({
    gameId: range.gameId,
    startDate: range.startDate,
    endDate: range.endDate,
  });
  if (range.userId?.trim()) {
    query.set('userId', range.userId.trim());
  }

  return query.toString();
}

function compactSettlementRange(range: AdminSettlementRange) {
  return {
    endDate: range.endDate,
    gameId: range.gameId,
    startDate: range.startDate,
    ...(range.userId?.trim() ? { userId: range.userId.trim() } : {}),
  };
}

export const aiKsApi = {
  getIntegrationStatus() {
    return requestJson<IntegrationStatus>('/integrations/status');
  },

  queryGuestEarnings(identity: string) {
    return requestJson<EarningsResult>(
      `/user/earnings?identity=${encodeURIComponent(identity)}`,
    );
  },

  registerAccount(payload: {
    invitationCode?: string | null;
    password: string;
    username: string;
  }) {
    return requestJson<AuthResult>('/accounts/register', {
      body: payload,
      method: 'POST',
    });
  },

  loginAccount(payload: { password: string; username: string }) {
    return requestJson<AuthResult>('/accounts/login', {
      body: payload,
      method: 'POST',
    });
  },

  loginAgent(payload: { password: string; username: string }) {
    return requestJson<AgentAuthResult>('/agents/login', {
      body: payload,
      method: 'POST',
    });
  },

  getCurrentAccount(accessToken: string) {
    return requestJson<AccountResult>('/accounts/me', { accessToken });
  },

  getCurrentAgent(accessToken: string) {
    return requestJson<AgentProfile>('/agents/me', { accessToken });
  },

  getAgentEarnings(accessToken: string) {
    return requestJson<AgentEarningsResult>('/agents/me/earnings', {
      accessToken,
    });
  },

  getAgentUsers(accessToken: string) {
    return requestJson<AgentUsersResult>('/agents/me/users', {
      accessToken,
    });
  },

  getAgentAlipayProfile(accessToken: string) {
    return requestJson<AlipayProfile>('/agents/me/alipay', { accessToken });
  },

  updateAgentAlipayProfile(
    accessToken: string,
    payload: { alipayAccount: string; alipayRealName: string },
  ) {
    return requestJson<AlipayProfile>('/agents/me/alipay', {
      accessToken,
      body: payload,
      method: 'PATCH',
    });
  },

  requestAgentWithdrawal(accessToken: string, amountYuan: string) {
    return requestJson<AdminWithdrawalBatch>('/agents/me/withdrawals', {
      accessToken,
      body: { amountYuan },
      method: 'POST',
    });
  },

  getAgentWithdrawals(accessToken: string) {
    return requestJson<AgentWithdrawalListResult>('/agents/me/withdrawals', {
      accessToken,
    });
  },

  bindAccountOpenId(accessToken: string, identity: string) {
    return requestJson<unknown>('/accounts/me/open-ids', {
      accessToken,
      body: { identity },
      method: 'POST',
    });
  },

  getAccountEarnings(accessToken: string) {
    return requestJson<AccountEarningsResult>('/accounts/me/earnings', {
      accessToken,
    });
  },

  getAccountAgentBinding(accessToken: string) {
    return requestJson<AccountAgentBindingResult>(
      '/accounts/me/agent-binding',
      {
        accessToken,
      },
    );
  },

  bindAccountAgent(accessToken: string, invitationCode: string) {
    return requestJson<AccountAgentBindingResult>(
      '/accounts/me/agent-binding',
      {
        accessToken,
        body: { invitationCode },
        method: 'PATCH',
      },
    );
  },

  getAlipayProfile(accessToken: string) {
    return requestJson<AlipayProfile>('/accounts/me/alipay', { accessToken });
  },

  updateAlipayProfile(
    accessToken: string,
    payload: { alipayAccount: string; alipayRealName: string },
  ) {
    return requestJson<AlipayProfile>('/accounts/me/alipay', {
      accessToken,
      body: payload,
      method: 'PATCH',
    });
  },

  requestWithdrawal(accessToken: string, amountYuan: string) {
    return requestJson<WithdrawalResult>('/accounts/me/withdrawals', {
      accessToken,
      body: { amountYuan },
      method: 'POST',
    });
  },

  loginAdmin(payload: { password: string; username: string }) {
    return requestJson<AdminAuthResult>('/admin/auth/login', {
      body: payload,
      method: 'POST',
    });
  },

  getCurrentAdmin(adminAccessToken: string) {
    return requestJson<CurrentAdminResult>('/admin/auth/me', {
      accessToken: adminAccessToken,
    });
  },

  getAdminCompanies(adminAccessToken: string) {
    return requestJson<AdminCompanyListResult>('/admin/companies', {
      accessToken: adminAccessToken,
    });
  },

  getCompanyAdmins(adminAccessToken: string) {
    return requestJson<AdminCompanyAdminListResult>('/admin/company-admins', {
      accessToken: adminAccessToken,
    });
  },

  getAdminAgents(adminAccessToken: string) {
    return requestJson<AdminAgentListResult>('/admin/agents', {
      accessToken: adminAccessToken,
    });
  },

  createAdminAgent(
    adminAccessToken: string,
    payload: {
      invitationCode: string;
      parentAgentId?: string | null;
      password: string;
      username: string;
    },
  ) {
    return requestJson<AdminAgentResult>('/admin/agents', {
      accessToken: adminAccessToken,
      body: payload,
      method: 'POST',
    });
  },

  updateAdminAgentAlipay(
    adminAccessToken: string,
    agentId: string,
    payload: {
      alipayAccount: string;
      alipayRealName: string;
    },
  ) {
    return requestJson<AdminAgentResult>(agentPath(agentId, '/alipay'), {
      accessToken: adminAccessToken,
      body: payload,
      method: 'PATCH',
    });
  },

  requestAdminAgentWithdrawal(
    adminAccessToken: string,
    agentId: string,
    payload: {
      amountYuan: string;
    },
  ) {
    return requestJson<AdminWithdrawalBatch>(agentPath(agentId, '/withdrawals'), {
      accessToken: adminAccessToken,
      body: payload,
      method: 'POST',
    });
  },

  getPlatformConfig(adminAccessToken: string) {
    return requestJson<PlatformConfig>('/admin/platform-config', {
      accessToken: adminAccessToken,
    });
  },

  updatePlatformConfig(
    adminAccessToken: string,
    payload: PlatformConfigUpdateInput,
  ) {
    return requestJson<PlatformConfig>('/admin/platform-config', {
      accessToken: adminAccessToken,
      body: payload,
      method: 'PATCH',
    });
  },

  createCompanyAdmin(
    adminAccessToken: string,
    payload: {
      displayName: string;
      enabled?: boolean;
      password: string;
      username: string;
    },
  ) {
    return requestJson<AdminCompanyAdminResult>('/admin/company-admins', {
      accessToken: adminAccessToken,
      body: payload,
      method: 'POST',
    });
  },

  updateCompanyAdmin(
    adminAccessToken: string,
    adminId: string,
    payload: {
      displayName?: string;
      enabled?: boolean;
      password?: string;
    },
  ) {
    return requestJson<AdminCompanyAdminResult>(companyAdminPath(adminId), {
      accessToken: adminAccessToken,
      body: payload,
      method: 'PATCH',
    });
  },

  updateCompanyAdminScopes(
    adminAccessToken: string,
    adminId: string,
    payload: {
      scopes: Array<{
        companyId: string;
        gameIds: string[];
      }>;
    },
  ) {
    return requestJson<AdminCompanyAdminResult>(
      companyAdminPath(adminId, '/scopes'),
      {
        accessToken: adminAccessToken,
        body: payload,
        method: 'PUT',
      },
    );
  },

  createAdminCompany(adminAccessToken: string, payload: { name: string }) {
    return requestJson<{ company: AdminCompany }>('/admin/companies', {
      accessToken: adminAccessToken,
      body: payload,
      method: 'POST',
    });
  },

  adjustCompanyBalance(
    adminAccessToken: string,
    companyId: string,
    payload: { amountYuan: string; reason?: string },
  ) {
    return requestJson<{ company: AdminCompany }>(
      companyPath(companyId, '/balance-adjustments'),
      {
        accessToken: adminAccessToken,
        body: payload,
        method: 'POST',
      },
    );
  },

  getAdminGames(adminAccessToken: string, companyId?: string) {
    const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : '';
    return requestJson<AdminGameListResult>(`/admin/games${query}`, {
      accessToken: adminAccessToken,
    });
  },

  createAdminGame(
    adminAccessToken: string,
    payload: {
      companyId: string;
      gameAppId: string;
      gameSecret: string;
      name: string;
    },
  ) {
    return requestJson<{ game: AdminGame }>('/admin/games', {
      accessToken: adminAccessToken,
      body: payload,
      method: 'POST',
    });
  },

  updateAdminGame(
    adminAccessToken: string,
    gameId: string,
    payload: {
      ecpmAutoSyncEnabled?: boolean;
      ecpmAutoSyncIntervalHours?: EcpmLookbackHours;
      gameSecret?: string;
      name?: string;
      settlementPaused?: boolean;
    },
  ) {
    return requestJson<{ game: AdminGame }>(gamePath(gameId), {
      accessToken: adminAccessToken,
      body: payload,
      method: 'PATCH',
    });
  },

  allocateGameBudget(
    adminAccessToken: string,
    gameId: string,
    payload: { amountYuan: string; reason?: string },
  ) {
    return requestJson<AdminGameBudgetAllocationResult>(
      gamePath(gameId, '/budget-allocations'),
      {
        accessToken: adminAccessToken,
        body: payload,
        method: 'POST',
      },
    );
  },

  createGameSession(payload: { gameAppId: string; jsCode: string }) {
    return requestJson<GameSessionResult>('/game/sessions', {
      body: payload,
      method: 'POST',
    });
  },

  refreshEcpm(
    adminAccessToken: string,
    gameAppId: string,
    lookbackHours: EcpmLookbackHours = 1,
  ) {
    return requestJson<EcpmRefreshResult>('/admin/kuaishou/ecpm/refresh', {
      accessToken: adminAccessToken,
      body: { gameAppId, lookbackHours },
      method: 'POST',
    });
  },

  getKuaishouEcpmJobs(
    adminAccessToken: string,
    limit = 20,
    gameAppId?: string,
  ) {
    const query = new URLSearchParams({ limit: String(limit) });
    if (gameAppId) {
      query.set('gameAppId', gameAppId);
    }

    return requestJson<KuaishouEcpmSyncJobListResult>(
      `/admin/kuaishou/ecpm/jobs?${query}`,
      {
        accessToken: adminAccessToken,
      },
    );
  },

  retryKuaishouEcpmJob(adminAccessToken: string, jobId: string) {
    return requestJson<EcpmRefreshResult>(
      kuaishouEcpmJobPath(jobId, '/retry'),
      {
        accessToken: adminAccessToken,
        body: {},
        method: 'POST',
      },
    );
  },

  getEcpmDashboard(
    adminAccessToken: string,
    scope: EcpmDashboardScope,
    query: Record<string, string | undefined>,
  ) {
    const params = new URLSearchParams();
    Object.entries(query).forEach(([key, value]) => {
      if (value) {
        params.set(key, value);
      }
    });

    return requestJson<EcpmDashboardResult>(
      `/admin/ecpm/dashboard/${scope}?${params}`,
      {
        accessToken: adminAccessToken,
      },
    );
  },

  updateEcpm(adminAccessToken: string, body: EcpmUpdateRequest) {
    return requestJson<EcpmUpdateJob>('/admin/ecpm/update', {
      accessToken: adminAccessToken,
      body,
      method: 'POST',
    });
  },

  getEcpmUpdateJobs(adminAccessToken: string, limit = 20) {
    const query = new URLSearchParams({ limit: String(limit) });

    return requestJson<EcpmUpdateJobListResult>(
      `/admin/ecpm/update-jobs?${query}`,
      {
        accessToken: adminAccessToken,
      },
    );
  },

  getEcpmUpdateJob(adminAccessToken: string, jobId: string) {
    return requestJson<EcpmUpdateJob>(ecpmUpdateJobPath(jobId), {
      accessToken: adminAccessToken,
    });
  },

  retryEcpmUpdateJob(adminAccessToken: string, jobId: string) {
    return requestJson<EcpmUpdateJob>(ecpmUpdateJobPath(jobId, '/retry'), {
      accessToken: adminAccessToken,
      body: {},
      method: 'POST',
    });
  },

  getKuaishouTokenStatus(adminAccessToken: string) {
    return requestJson<KuaishouTokenStatusResult>('/admin/kuaishou/token', {
      accessToken: adminAccessToken,
    });
  },

  authorizeKuaishouToken(
    adminAccessToken: string,
    payload: {
      appId: string;
      authCode: string;
      secret: string;
    },
  ) {
    return requestJson<KuaishouTokenStatusResult>(
      '/admin/kuaishou/token/authorize',
      {
        accessToken: adminAccessToken,
        body: payload,
        method: 'POST',
      },
    );
  },

  refreshKuaishouToken(adminAccessToken: string) {
    return requestJson<KuaishouTokenStatusResult>(
      '/admin/kuaishou/token/refresh',
      {
        accessToken: adminAccessToken,
        body: {},
        method: 'POST',
      },
    );
  },

  previewSettlement(adminAccessToken: string, range: AdminSettlementRange) {
    return requestJson<AdminSettlementPreview>(
      `/admin/settlements/preview?${settlementQuery(range)}`,
      { accessToken: adminAccessToken },
    );
  },

  confirmSettlement(adminAccessToken: string, range: AdminSettlementRange) {
    return requestJson<AdminSettlementConfirmResult>(
      '/admin/settlements/confirm',
      {
        accessToken: adminAccessToken,
        body: compactSettlementRange(range),
        method: 'POST',
      },
    );
  },

  getSettlementBatches(adminAccessToken: string, gameId?: string) {
    const query = gameId ? `?gameId=${encodeURIComponent(gameId)}` : '';
    return requestJson<AdminSettlementListResult>(`/admin/settlements${query}`, {
      accessToken: adminAccessToken,
    });
  },

  getSettlementDetail(adminAccessToken: string, batchId: string) {
    return requestJson<AdminSettlementDetailResult>(
      `/admin/settlements/${encodeURIComponent(batchId)}`,
      { accessToken: adminAccessToken },
    );
  },

  getAdminWithdrawals(adminAccessToken: string, status: string) {
    return requestJson<AdminWithdrawalListResult>(
      `/admin/withdrawals?status=${encodeURIComponent(status)}`,
      { accessToken: adminAccessToken },
    );
  },

  getWithdrawalDetail(adminAccessToken: string, batchId: string) {
    return requestJson<AdminWithdrawalDetailResult>(
      withdrawalPath(batchId),
      { accessToken: adminAccessToken },
    );
  },

  approveWithdrawal(adminAccessToken: string, batchId: string) {
    return requestJson<AdminWithdrawalBatch>(
      withdrawalPath(batchId, '/approve'),
      {
        accessToken: adminAccessToken,
        body: {},
        method: 'POST',
      },
    );
  },

  payWithdrawal(
    adminAccessToken: string,
    batchId: string,
    mockResult: 'failed' | 'success',
  ) {
    return requestJson<AdminWithdrawalBatch>(withdrawalPath(batchId, '/pay'), {
      accessToken: adminAccessToken,
      body: { mockResult },
      method: 'POST',
    });
  },

  closeWithdrawal(adminAccessToken: string, batchId: string) {
    return requestJson<AdminWithdrawalBatch>(withdrawalPath(batchId, '/close'), {
      accessToken: adminAccessToken,
      body: {},
      method: 'POST',
    });
  },

  getAuditLogs(adminAccessToken: string) {
    return requestJson<AuditLogListResult>('/admin/audit-logs?limit=20', {
      accessToken: adminAccessToken,
    });
  },

  clearOperationalData(adminAccessToken: string) {
    return requestJson<{ success: true }>('/admin/system/operational-data/clear', {
      accessToken: adminAccessToken,
      body: {
        confirmation: 'CLEAR_OPERATIONAL_DATA',
      },
      method: 'POST',
    });
  },

  getBusinessClosure(adminAccessToken: string) {
    return requestJson<BusinessClosureReport>('/admin/business-closure', {
      accessToken: adminAccessToken,
    });
  },

  getUserDashboardOverview(accessToken: string, date?: string) {
    const qs = date ? `?date=${encodeURIComponent(date)}` : '';
    return requestJson<UserDashboardOverview>(
      `/users/me/dashboard/overview${qs}`,
      { accessToken },
    );
  },

  getUserDashboardGroups(accessToken: string, date?: string) {
    const qs = date ? `?date=${encodeURIComponent(date)}` : '';
    return requestJson<UserDashboardGameGroup[]>(
      `/users/me/dashboard/groups${qs}`,
      { accessToken },
    );
  },

  getUserDashboardRecords(
    accessToken: string,
    input: {
      date?: string;
      gameId?: string;
      accountId?: string;
      limit?: number;
    } = {},
  ) {
    const params = new URLSearchParams();
    if (input.date) params.set('date', input.date);
    if (input.gameId) params.set('gameId', input.gameId);
    if (input.accountId) params.set('accountId', input.accountId);
    if (input.limit) params.set('limit', String(input.limit));
    const qs = params.toString();
    return requestJson<UserDashboardEcpmRecordsResult>(
      `/users/me/dashboard/records${qs ? '?' + qs : ''}`,
      { accessToken },
    );
  },

  getSuperAdminDashboardOverview(adminAccessToken: string, date?: string) {
    const qs = date ? `?date=${encodeURIComponent(date)}` : '';
    return requestJson<SuperAdminOverview>(`/admin/dashboard/overview${qs}`, {
      accessToken: adminAccessToken,
    });
  },

  getSuperAdminDashboardCompanies(adminAccessToken: string, date?: string) {
    const qs = date ? `?date=${encodeURIComponent(date)}` : '';
    return requestJson<SuperAdminCompanyRow[]>(
      `/admin/dashboard/companies${qs}`,
      { accessToken: adminAccessToken },
    );
  },

  getSuperAdminDashboardAnomalies(adminAccessToken: string) {
    return requestJson<SuperAdminAnomalies>(`/admin/dashboard/anomalies`, {
      accessToken: adminAccessToken,
    });
  },
};
