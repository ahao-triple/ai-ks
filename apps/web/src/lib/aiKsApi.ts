import { requestJson } from './api';
import type {
  AccountEarningsResult,
  AccountResult,
  AdminAuthResult,
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
  SettlementResult,
  WithdrawalResult,
} from '../types/api';

function withdrawalPath(batchId: string, suffix = '') {
  return `/admin/withdrawals/${encodeURIComponent(batchId)}${suffix}`;
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

  confirmSettlement(accessToken: string) {
    return requestJson<SettlementResult>('/accounts/me/settlements/confirm', {
      accessToken,
      body: {},
      method: 'POST',
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
