import { requestJson } from './api';
import type {
  AccountEarningsResult,
  AccountResult,
  AdminAuthResult,
  AdminCompany,
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
  AlipayProfile,
  AuditLogListResult,
  AuthResult,
  DemoGame,
  EarningsResult,
  EcpmRefreshResult,
  GameSessionResult,
  IntegrationStatus,
  KuaishouTokenStatusResult,
  WithdrawalResult,
} from '../types/api';

function withdrawalPath(batchId: string, suffix = '') {
  return `/admin/withdrawals/${encodeURIComponent(batchId)}${suffix}`;
}

function companyPath(companyId: string, suffix = '') {
  return `/admin/companies/${encodeURIComponent(companyId)}${suffix}`;
}

function gamePath(gameId: string, suffix = '') {
  return `/admin/games/${encodeURIComponent(gameId)}${suffix}`;
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
  getDemoContext() {
    return requestJson<{ games: DemoGame[]; sampleJsCodes: string[] }>(
      '/demo/test-context',
    );
  },

  getIntegrationStatus() {
    return requestJson<IntegrationStatus>('/integrations/status');
  },

  queryGuestEarnings(identity: string) {
    return requestJson<EarningsResult>(
      `/user/earnings?identity=${encodeURIComponent(identity)}`,
    );
  },

  registerAccount(payload: { password: string; username: string }) {
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

  getCurrentAccount(accessToken: string) {
    return requestJson<AccountResult>('/accounts/me', { accessToken });
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

  getAdminCompanies(adminAccessToken: string) {
    return requestJson<AdminCompanyListResult>('/admin/companies', {
      accessToken: adminAccessToken,
    });
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

  refreshEcpm(adminAccessToken: string, gameAppId: string) {
    return requestJson<EcpmRefreshResult>('/admin/kuaishou/ecpm/refresh', {
      accessToken: adminAccessToken,
      body: { gameAppId },
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
};
