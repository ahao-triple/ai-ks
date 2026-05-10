import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { aiKsApi } from './aiKsApi';
import { API_BASE_URL } from './api';
import type {
  AdminCompany,
  AdminCompanyAdmin,
  AdminCompanyAdminListResult,
  AdminCompanyAdminResult,
  AdminCompanyListResult,
  AdminGame,
  AdminGameListResult,
  AdminGameBudgetAllocationResult,
  AdminSettlementBatch,
  AdminSettlementConfirmResult,
  AdminSettlementDetailResult,
  AdminSettlementListResult,
  AdminSettlementPreview,
  AdminWithdrawalBatch,
  AccountAgentBindingResult,
  AgentAuthResult,
  AgentEarningsResult,
  AgentProfile,
  AgentUsersResult,
  AgentWithdrawalListResult,
  BusinessClosureReport,
  CurrentAdminResult,
  EcpmDashboardResult,
  EcpmRefreshResult,
  EcpmUpdateJob,
  EcpmUpdateJobListResult,
  KuaishouEcpmSyncJob,
  KuaishouEcpmSyncJobListResult,
  KuaishouTokenStatusResult,
} from '../types/api';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

function mockJsonResponse(payload: unknown) {
  globalThis.fetch = vi.fn(async () => {
    return new Response(JSON.stringify(payload), {
      headers: { 'content-type': 'application/json' },
      status: 200,
    });
  }) as typeof fetch;
}

describe('aiKsApi', () => {
  it('queries guest earnings without an authorization header', async () => {
    mockJsonResponse({ rows: [] });

    await aiKsApi.queryGuestEarnings('OPEN ID');

    expect(globalThis.fetch).toHaveBeenCalledWith(
      `${API_BASE_URL}/user/earnings?identity=OPEN%20ID`,
      {
        body: undefined,
        headers: { 'Content-Type': 'application/json' },
        method: 'GET',
      },
    );
  });

  it('logs in accounts with username and password', async () => {
    mockJsonResponse({ accessToken: 'token', account: { id: '1' } });

    await aiKsApi.loginAccount({ username: 'demo', password: 'secret' });

    expect(globalThis.fetch).toHaveBeenCalledWith(`${API_BASE_URL}/accounts/login`, {
      body: expect.any(String),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    });
    const requestInit = vi.mocked(globalThis.fetch).mock.calls[0]?.[1];
    expect(JSON.parse(requestInit?.body as string)).toEqual({
      password: 'secret',
      username: 'demo',
    });
  });

  it('loads account earnings with the account token', async () => {
    mockJsonResponse({ rows: [] });

    await aiKsApi.getAccountEarnings('account-token');

    expect(globalThis.fetch).toHaveBeenCalledWith(
      `${API_BASE_URL}/accounts/me/earnings`,
      {
        body: undefined,
        headers: {
          Authorization: 'Bearer account-token',
          'Content-Type': 'application/json',
        },
        method: 'GET',
      },
    );
  });

  it('binds account agent invitations with the account token', async () => {
    mockJsonResponse({ agent: { id: 'agent-1' } });

    await aiKsApi.bindAccountAgent('account-token', 'AGENT1');

    expect(globalThis.fetch).toHaveBeenCalledWith(
      `${API_BASE_URL}/accounts/me/agent-binding`,
      {
        body: JSON.stringify({ invitationCode: 'AGENT1' }),
        headers: {
          Authorization: 'Bearer account-token',
          'Content-Type': 'application/json',
        },
        method: 'PATCH',
      },
    );
  });

  it('logs in agents and loads the agent portal with the agent token', async () => {
    mockJsonResponse({ accessToken: 'agent-token', agent: { id: 'agent-1' } });

    await aiKsApi.loginAgent({
      password: 'demo-agent-pass',
      username: 'demo_default_agent',
    });

    expect(globalThis.fetch).toHaveBeenCalledWith(`${API_BASE_URL}/agents/login`, {
      body: expect.any(String),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    });

    mockJsonResponse({ id: 'agent-1', username: 'agent_1' });
    await aiKsApi.getCurrentAgent('agent-token');

    expect(globalThis.fetch).toHaveBeenCalledWith(`${API_BASE_URL}/agents/me`, {
      body: undefined,
      headers: {
        Authorization: 'Bearer agent-token',
        'Content-Type': 'application/json',
      },
      method: 'GET',
    });
  });

  it('encodes withdrawal batch id path segments for mutations', async () => {
    mockJsonResponse({ id: 'batch 1/2', status: 'PENDING' });

    await aiKsApi.payWithdrawal('admin-token', 'batch 1/2', 'success');

    expect(globalThis.fetch).toHaveBeenCalledWith(
      `${API_BASE_URL}/admin/withdrawals/batch%201%2F2/pay`,
      {
        body: expect.any(String),
        headers: {
          Authorization: 'Bearer admin-token',
          'Content-Type': 'application/json',
        },
        method: 'POST',
      },
    );
    const requestInit = vi.mocked(globalThis.fetch).mock.calls[0]?.[1];
    expect(JSON.parse(requestInit?.body as string)).toEqual({
      mockResult: 'success',
    });
  });

  it('types withdrawal mutations as withdrawal batches', () => {
    expectTypeOf(aiKsApi.approveWithdrawal)
      .returns.resolves.toEqualTypeOf<AdminWithdrawalBatch>();
    expectTypeOf(aiKsApi.payWithdrawal)
      .returns.resolves.toEqualTypeOf<AdminWithdrawalBatch>();
    expectTypeOf(aiKsApi.closeWithdrawal)
      .returns.resolves.toEqualTypeOf<AdminWithdrawalBatch>();
  });

  it('types settlement methods as admin settlement responses', () => {
    expectTypeOf(aiKsApi.previewSettlement)
      .returns.resolves.toEqualTypeOf<AdminSettlementPreview>();
    expectTypeOf(aiKsApi.confirmSettlement)
      .returns.resolves.toEqualTypeOf<AdminSettlementConfirmResult>();
    expectTypeOf(aiKsApi.getSettlementBatches)
      .returns.resolves.toEqualTypeOf<AdminSettlementListResult>();
    expectTypeOf(aiKsApi.getSettlementDetail)
      .returns.resolves.toEqualTypeOf<AdminSettlementDetailResult>();
    expectTypeOf<AdminSettlementBatch['configSnapshot']>().toEqualTypeOf<unknown>();
  });

  it('types admin resource methods as company and game responses', () => {
    expectTypeOf<AdminCompanyAdmin>().toMatchTypeOf<{
      createdAt: string;
      deletedAt: string | null;
      updatedAt: string;
    }>();
    expectTypeOf(aiKsApi.getCurrentAdmin)
      .returns.resolves.toEqualTypeOf<CurrentAdminResult>();
    expectTypeOf(aiKsApi.getAdminCompanies)
      .returns.resolves.toEqualTypeOf<AdminCompanyListResult>();
    expectTypeOf(aiKsApi.createAdminCompany)
      .returns.resolves.toEqualTypeOf<{ company: AdminCompany }>();
    expectTypeOf(aiKsApi.getCompanyAdmins)
      .returns.resolves.toEqualTypeOf<AdminCompanyAdminListResult>();
    expectTypeOf(aiKsApi.createCompanyAdmin)
      .returns.resolves.toEqualTypeOf<AdminCompanyAdminResult>();
    expectTypeOf(aiKsApi.updateCompanyAdmin)
      .returns.resolves.toEqualTypeOf<AdminCompanyAdminResult>();
    expectTypeOf(aiKsApi.updateCompanyAdminScopes)
      .returns.resolves.toEqualTypeOf<AdminCompanyAdminResult>();
    expectTypeOf(aiKsApi.getAdminGames)
      .returns.resolves.toEqualTypeOf<AdminGameListResult>();
    expectTypeOf(aiKsApi.createAdminGame)
      .returns.resolves.toEqualTypeOf<{ game: AdminGame }>();
    expectTypeOf(aiKsApi.updateAdminGame)
      .returns.resolves.toEqualTypeOf<{ game: AdminGame }>();
    expectTypeOf(aiKsApi.allocateGameBudget)
      .returns.resolves.toEqualTypeOf<AdminGameBudgetAllocationResult>();
    expectTypeOf(aiKsApi.resetTestData)
      .returns.resolves.toEqualTypeOf<{ success: true }>();
    expectTypeOf(aiKsApi.getBusinessClosure)
      .returns.resolves.toEqualTypeOf<BusinessClosureReport>();
  });

  it('types agent portal methods as agent responses', () => {
    expectTypeOf(aiKsApi.loginAgent)
      .returns.resolves.toEqualTypeOf<AgentAuthResult>();
    expectTypeOf(aiKsApi.getCurrentAgent)
      .returns.resolves.toEqualTypeOf<AgentProfile>();
    expectTypeOf(aiKsApi.getAgentEarnings)
      .returns.resolves.toEqualTypeOf<AgentEarningsResult>();
    expectTypeOf(aiKsApi.getAgentWithdrawals)
      .returns.resolves.toEqualTypeOf<AgentWithdrawalListResult>();
    expectTypeOf(aiKsApi.getAgentUsers)
      .returns.resolves.toEqualTypeOf<AgentUsersResult>();
    expectTypeOf(aiKsApi.getAccountAgentBinding)
      .returns.resolves.toEqualTypeOf<AccountAgentBindingResult>();
    expectTypeOf(aiKsApi.bindAccountAgent)
      .returns.resolves.toEqualTypeOf<AccountAgentBindingResult>();
  });

  it('types kuaishou token methods as token status responses', () => {
    expectTypeOf(aiKsApi.getKuaishouTokenStatus)
      .returns.resolves.toEqualTypeOf<KuaishouTokenStatusResult>();
    expectTypeOf(aiKsApi.authorizeKuaishouToken)
      .returns.resolves.toEqualTypeOf<KuaishouTokenStatusResult>();
    expectTypeOf(aiKsApi.refreshKuaishouToken)
      .returns.resolves.toEqualTypeOf<KuaishouTokenStatusResult>();
  });

  it('types kuaishou ecpm job methods and refresh responses', () => {
    expectTypeOf(aiKsApi.getKuaishouEcpmJobs)
      .returns.resolves.toEqualTypeOf<KuaishouEcpmSyncJobListResult>();
    expectTypeOf(aiKsApi.retryKuaishouEcpmJob)
      .returns.resolves.toEqualTypeOf<EcpmRefreshResult>();
    expectTypeOf<EcpmRefreshResult['job']>().toEqualTypeOf<KuaishouEcpmSyncJob>();
  });

  it('types ecpm dashboard and update methods as ecpm responses', () => {
    expectTypeOf(aiKsApi.getEcpmDashboard)
      .returns.resolves.toEqualTypeOf<EcpmDashboardResult>();
    expectTypeOf(aiKsApi.updateEcpm)
      .returns.resolves.toEqualTypeOf<EcpmUpdateJob>();
    expectTypeOf(aiKsApi.getEcpmUpdateJobs)
      .returns.resolves.toEqualTypeOf<EcpmUpdateJobListResult>();
    expectTypeOf(aiKsApi.getEcpmUpdateJob)
      .returns.resolves.toEqualTypeOf<EcpmUpdateJob>();
    expectTypeOf(aiKsApi.retryEcpmUpdateJob)
      .returns.resolves.toEqualTypeOf<EcpmUpdateJob>();
  });

  it('loads admin companies with the admin token', async () => {
    mockJsonResponse({ companies: [] });

    await aiKsApi.getAdminCompanies('admin-token');

    expect(globalThis.fetch).toHaveBeenCalledWith(
      `${API_BASE_URL}/admin/companies`,
      {
        body: undefined,
        headers: {
          Authorization: 'Bearer admin-token',
          'Content-Type': 'application/json',
        },
        method: 'GET',
      },
    );
  });

  it('resets test data with super admin confirmation payload', async () => {
    mockJsonResponse({ success: true });

    await aiKsApi.resetTestData('admin-token');

    expect(globalThis.fetch).toHaveBeenCalledWith(
      `${API_BASE_URL}/admin/system/reset-test-data`,
      {
        body: JSON.stringify({
          confirmation: 'RESET_TEST_DATA',
        }),
        headers: {
          Authorization: 'Bearer admin-token',
          'Content-Type': 'application/json',
        },
        method: 'POST',
      },
    );
  });

  it('loads business closure checks with the admin token', async () => {
    mockJsonResponse({ checks: [], metrics: {}, summary: {} });

    await aiKsApi.getBusinessClosure('admin-token');

    expect(globalThis.fetch).toHaveBeenCalledWith(
      `${API_BASE_URL}/admin/business-closure`,
      {
        body: undefined,
        headers: {
          Authorization: 'Bearer admin-token',
          'Content-Type': 'application/json',
        },
        method: 'GET',
      },
    );
  });

  it('loads current admin principal with the admin token', async () => {
    mockJsonResponse({
      admin: {
        adminId: 'company-admin-1',
        displayName: '上海运营',
        role: 'COMPANY_ADMIN',
        username: 'company_admin',
      },
    });

    await aiKsApi.getCurrentAdmin('admin-token');

    expect(globalThis.fetch).toHaveBeenCalledWith(
      `${API_BASE_URL}/admin/auth/me`,
      {
        body: undefined,
        headers: {
          Authorization: 'Bearer admin-token',
          'Content-Type': 'application/json',
        },
        method: 'GET',
      },
    );
  });

  it('manages company admins through super admin endpoints', async () => {
    mockJsonResponse({ admins: [] });
    await aiKsApi.getCompanyAdmins('admin-token');
    expect(globalThis.fetch).toHaveBeenLastCalledWith(
      `${API_BASE_URL}/admin/company-admins`,
      expect.objectContaining({ method: 'GET' }),
    );

    mockJsonResponse({ admin: { id: 'company-admin-1' } });
    await aiKsApi.createCompanyAdmin('admin-token', {
      displayName: '上海运营',
      password: 'companypass',
      username: 'company_admin',
    });
    expect(globalThis.fetch).toHaveBeenLastCalledWith(
      `${API_BASE_URL}/admin/company-admins`,
      expect.objectContaining({ method: 'POST' }),
    );

    mockJsonResponse({ admin: { id: 'company-admin-1' } });
    await aiKsApi.updateCompanyAdminScopes('admin-token', 'company-admin-1', {
      scopes: [{ companyId: 'company-1', gameIds: ['game-1'] }],
    });
    expect(globalThis.fetch).toHaveBeenLastCalledWith(
      `${API_BASE_URL}/admin/company-admins/company-admin-1/scopes`,
      expect.objectContaining({ method: 'PUT' }),
    );
  });

  it('updates company admins with encoded ids and allowed fields', async () => {
    mockJsonResponse({ admin: { id: 'company admin/1' } });

    await aiKsApi.updateCompanyAdmin('admin-token', 'company admin/1', {
      displayName: '上海运营',
      enabled: false,
      password: 'newpass123',
    });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      `${API_BASE_URL}/admin/company-admins/company%20admin%2F1`,
      {
        body: JSON.stringify({
          displayName: '上海运营',
          enabled: false,
          password: 'newpass123',
        }),
        headers: {
          Authorization: 'Bearer admin-token',
          'Content-Type': 'application/json',
        },
        method: 'PATCH',
      },
    );
  });

  it('adjusts company balance with an encoded company id and request body', async () => {
    mockJsonResponse({ company: { id: 'company 1/2' } });

    await aiKsApi.adjustCompanyBalance('admin-token', 'company 1/2', {
      amountYuan: '100.00',
      reason: 'seed',
    });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      `${API_BASE_URL}/admin/companies/company%201%2F2/balance-adjustments`,
      {
        body: JSON.stringify({
          amountYuan: '100.00',
          reason: 'seed',
        }),
        headers: {
          Authorization: 'Bearer admin-token',
          'Content-Type': 'application/json',
        },
        method: 'POST',
      },
    );
  });

  it('lists admin games with an optional encoded company id', async () => {
    mockJsonResponse({ games: [] });

    await aiKsApi.getAdminGames('admin-token', 'company 1');

    expect(globalThis.fetch).toHaveBeenCalledWith(
      `${API_BASE_URL}/admin/games?companyId=company%201`,
      {
        body: undefined,
        headers: {
          Authorization: 'Bearer admin-token',
          'Content-Type': 'application/json',
        },
        method: 'GET',
      },
    );
  });

  it('creates admin games with company and credential fields', async () => {
    mockJsonResponse({ game: { id: 'game-1' } });

    await aiKsApi.createAdminGame('admin-token', {
      companyId: 'company-1',
      gameAppId: 'ks_game_001',
      gameSecret: 'secret-1',
      name: 'Runner',
    });

    const requestInit = vi.mocked(globalThis.fetch).mock.calls[0]?.[1];
    expect(globalThis.fetch).toHaveBeenCalledWith(`${API_BASE_URL}/admin/games`, {
      body: expect.any(String),
      headers: {
        Authorization: 'Bearer admin-token',
        'Content-Type': 'application/json',
      },
      method: 'POST',
    });
    expect(JSON.parse(requestInit?.body as string)).toEqual({
      companyId: 'company-1',
      gameAppId: 'ks_game_001',
      gameSecret: 'secret-1',
      name: 'Runner',
    });
  });

  it('updates admin games with encoded ids and allowed fields', async () => {
    mockJsonResponse({ game: { id: 'game 1/2' } });

    await aiKsApi.updateAdminGame('admin-token', 'game 1/2', {
      ecpmAutoSyncEnabled: true,
      ecpmAutoSyncIntervalHours: 6,
      gameSecret: 'secret-2',
      name: 'Runner Pro',
      settlementPaused: false,
    });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      `${API_BASE_URL}/admin/games/game%201%2F2`,
      {
        body: JSON.stringify({
          ecpmAutoSyncEnabled: true,
          ecpmAutoSyncIntervalHours: 6,
          gameSecret: 'secret-2',
          name: 'Runner Pro',
          settlementPaused: false,
        }),
        headers: {
          Authorization: 'Bearer admin-token',
          'Content-Type': 'application/json',
        },
        method: 'PATCH',
      },
    );
  });

  it('allocates game budget with an encoded game id and request body', async () => {
    mockJsonResponse({ company: { id: 'company-1' }, game: { id: 'game 1/2' } });

    await aiKsApi.allocateGameBudget('admin-token', 'game 1/2', {
      amountYuan: '30.00',
      reason: 'launch',
    });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      `${API_BASE_URL}/admin/games/game%201%2F2/budget-allocations`,
      {
        body: JSON.stringify({
          amountYuan: '30.00',
          reason: 'launch',
        }),
        headers: {
          Authorization: 'Bearer admin-token',
          'Content-Type': 'application/json',
        },
        method: 'POST',
      },
    );
  });

  it('refreshes kuaishou ecpm with lookback hours', async () => {
    mockJsonResponse({ requestedOpenIds: [], rows: [], savedCount: 0 });

    await aiKsApi.refreshEcpm('admin-token', 'ks game/1', 12);

    expect(globalThis.fetch).toHaveBeenCalledWith(
      `${API_BASE_URL}/admin/kuaishou/ecpm/refresh`,
      {
        body: JSON.stringify({
          gameAppId: 'ks game/1',
          lookbackHours: 12,
        }),
        headers: {
          Authorization: 'Bearer admin-token',
          'Content-Type': 'application/json',
        },
        method: 'POST',
      },
    );
  });

  it('defaults kuaishou ecpm refresh lookback to one hour', async () => {
    mockJsonResponse({ requestedOpenIds: [], rows: [], savedCount: 0 });

    await aiKsApi.refreshEcpm('admin-token', 'ks_game_001');

    const requestInit = vi.mocked(globalThis.fetch).mock.calls[0]?.[1];
    expect(JSON.parse(requestInit?.body as string)).toEqual({
      gameAppId: 'ks_game_001',
      lookbackHours: 1,
    });
  });

  it('loads kuaishou token status with the admin token', async () => {
    mockJsonResponse({ configured: false, source: 'none', status: 'UNCONFIGURED' });

    await aiKsApi.getKuaishouTokenStatus('admin-token');

    expect(globalThis.fetch).toHaveBeenCalledWith(
      `${API_BASE_URL}/admin/kuaishou/token`,
      {
        body: undefined,
        headers: {
          Authorization: 'Bearer admin-token',
          'Content-Type': 'application/json',
        },
        method: 'GET',
      },
    );
  });

  it('loads kuaishou ecpm sync jobs with the admin token', async () => {
    mockJsonResponse({ jobs: [] });

    await aiKsApi.getKuaishouEcpmJobs('admin-token', 50);

    expect(globalThis.fetch).toHaveBeenCalledWith(
      `${API_BASE_URL}/admin/kuaishou/ecpm/jobs?limit=50`,
      {
        body: undefined,
        headers: {
          Authorization: 'Bearer admin-token',
          'Content-Type': 'application/json',
        },
        method: 'GET',
      },
    );
  });

  it('loads kuaishou ecpm sync jobs with an optional encoded game app id', async () => {
    mockJsonResponse({ jobs: [] });

    await aiKsApi.getKuaishouEcpmJobs('admin-token', 50, 'ks game/1');

    expect(globalThis.fetch).toHaveBeenCalledWith(
      `${API_BASE_URL}/admin/kuaishou/ecpm/jobs?limit=50&gameAppId=ks+game%2F1`,
      {
        body: undefined,
        headers: {
          Authorization: 'Bearer admin-token',
          'Content-Type': 'application/json',
        },
        method: 'GET',
      },
    );
  });

  it('retries kuaishou ecpm sync jobs with an encoded job id', async () => {
    mockJsonResponse({ requestedOpenIds: [], rows: [], savedCount: 0 });

    await aiKsApi.retryKuaishouEcpmJob('admin-token', 'job 1/2');

    expect(globalThis.fetch).toHaveBeenCalledWith(
      `${API_BASE_URL}/admin/kuaishou/ecpm/jobs/job%201%2F2/retry`,
      {
        body: JSON.stringify({}),
        headers: {
          Authorization: 'Bearer admin-token',
          'Content-Type': 'application/json',
        },
        method: 'POST',
      },
    );
  });

  it('loads latest ecpm dashboard rows with encoded query parameters', async () => {
    mockJsonResponse({ rows: [], scope: 'latest' });

    await aiKsApi.getEcpmDashboard('admin-token', 'latest', {
      companyId: 'company 1',
      endedDataHour: undefined,
      startedDataHour: '2026-05-08T14:00:00+08:00',
    });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/admin/ecpm/dashboard/latest?'),
      expect.objectContaining({ method: 'GET' }),
    );
    expect(globalThis.fetch).toHaveBeenCalledWith(
      `${API_BASE_URL}/admin/ecpm/dashboard/latest?companyId=company+1&startedDataHour=2026-05-08T14%3A00%3A00%2B08%3A00`,
      expect.any(Object),
    );
  });

  it('loads open-id ecpm dashboard rows through the snake case backend alias', async () => {
    mockJsonResponse({ rows: [], scope: 'open_id' });

    await aiKsApi.getEcpmDashboard('admin-token', 'open_id', {
      openId: 'open id/1',
    });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      `${API_BASE_URL}/admin/ecpm/dashboard/open_id?openId=open+id%2F1`,
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('updates ecpm data through the admin update endpoint', async () => {
    mockJsonResponse({ id: 'job-1', status: 'SUCCEEDED' });

    await aiKsApi.updateEcpm('admin-token', {
      endedDataHour: null,
      mode: 'latest',
      scopeId: 'game-1',
      scopeType: 'game',
      startedDataHour: null,
    });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/admin/ecpm/update'),
      expect.objectContaining({ method: 'POST' }),
    );
    const requestInit = vi.mocked(globalThis.fetch).mock.calls[0]?.[1];
    expect(JSON.parse(requestInit?.body as string)).toEqual({
      endedDataHour: null,
      mode: 'latest',
      scopeId: 'game-1',
      scopeType: 'game',
      startedDataHour: null,
    });
  });

  it('retries ecpm update jobs with an encoded job id', async () => {
    mockJsonResponse({ id: 'retry-job-1', status: 'RUNNING' });

    await aiKsApi.retryEcpmUpdateJob('admin-token', 'job 1/2');

    expect(globalThis.fetch).toHaveBeenCalledWith(
      `${API_BASE_URL}/admin/ecpm/update-jobs/job%201%2F2/retry`,
      {
        body: JSON.stringify({}),
        headers: {
          Authorization: 'Bearer admin-token',
          'Content-Type': 'application/json',
        },
        method: 'POST',
      },
    );
  });

  it('authorizes kuaishou token credentials with the admin token', async () => {
    mockJsonResponse({ configured: true, source: 'database', status: 'ACTIVE' });

    await aiKsApi.authorizeKuaishouToken('admin-token', {
      appId: 'app-1',
      authCode: 'auth-code-1',
      secret: 'secret-1',
    });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      `${API_BASE_URL}/admin/kuaishou/token/authorize`,
      {
        body: JSON.stringify({
          appId: 'app-1',
          authCode: 'auth-code-1',
          secret: 'secret-1',
        }),
        headers: {
          Authorization: 'Bearer admin-token',
          'Content-Type': 'application/json',
        },
        method: 'POST',
      },
    );
  });

  it('refreshes kuaishou token credentials with the admin token', async () => {
    mockJsonResponse({ configured: true, source: 'database', status: 'ACTIVE' });

    await aiKsApi.refreshKuaishouToken('admin-token');

    expect(globalThis.fetch).toHaveBeenCalledWith(
      `${API_BASE_URL}/admin/kuaishou/token/refresh`,
      {
        body: JSON.stringify({}),
        headers: {
          Authorization: 'Bearer admin-token',
          'Content-Type': 'application/json',
        },
        method: 'POST',
      },
    );
  });

  it('previews admin settlement with encoded query parameters', async () => {
    mockJsonResponse({ settlementCount: 2 });

    await aiKsApi.previewSettlement('admin-token', {
      endDate: '2026-05-08',
      gameId: 'game 1',
      startDate: '2026-05-08',
      userId: ' user-1 ',
    });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      `${API_BASE_URL}/admin/settlements/preview?gameId=game+1&startDate=2026-05-08&endDate=2026-05-08&userId=user-1`,
      {
        body: undefined,
        headers: {
          Authorization: 'Bearer admin-token',
          'Content-Type': 'application/json',
        },
        method: 'GET',
      },
    );
  });

  it('omits blank user ids from admin settlement preview query parameters', async () => {
    mockJsonResponse({ settlementCount: 2 });

    await aiKsApi.previewSettlement('admin-token', {
      endDate: '2026-05-08',
      gameId: 'game-1',
      startDate: '2026-05-08',
      userId: '   ',
    });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      `${API_BASE_URL}/admin/settlements/preview?gameId=game-1&startDate=2026-05-08&endDate=2026-05-08`,
      {
        body: undefined,
        headers: {
          Authorization: 'Bearer admin-token',
          'Content-Type': 'application/json',
        },
        method: 'GET',
      },
    );
  });

  it('confirms admin settlement with the admin token and compact request body', async () => {
    mockJsonResponse({ batch: { id: 'batch-1' }, items: [] });

    await aiKsApi.confirmSettlement('admin-token', {
      endDate: '2026-05-08',
      gameId: 'game-1',
      startDate: '2026-05-08',
      userId: '   ',
    });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      `${API_BASE_URL}/admin/settlements/confirm`,
      {
        body: JSON.stringify({
          endDate: '2026-05-08',
          gameId: 'game-1',
          startDate: '2026-05-08',
        }),
        headers: {
          Authorization: 'Bearer admin-token',
          'Content-Type': 'application/json',
        },
        method: 'POST',
      },
    );
  });

  it('lists settlement batches with an optional encoded game id', async () => {
    mockJsonResponse({ batches: [] });

    await aiKsApi.getSettlementBatches('admin-token', 'game 1/2');

    expect(globalThis.fetch).toHaveBeenCalledWith(
      `${API_BASE_URL}/admin/settlements?gameId=game%201%2F2`,
      {
        body: undefined,
        headers: {
          Authorization: 'Bearer admin-token',
          'Content-Type': 'application/json',
        },
        method: 'GET',
      },
    );
  });

  it('lists settlement batches without a query when game id is omitted', async () => {
    mockJsonResponse({ batches: [] });

    await aiKsApi.getSettlementBatches('admin-token');

    expect(globalThis.fetch).toHaveBeenCalledWith(
      `${API_BASE_URL}/admin/settlements`,
      {
        body: undefined,
        headers: {
          Authorization: 'Bearer admin-token',
          'Content-Type': 'application/json',
        },
        method: 'GET',
      },
    );
  });

  it('encodes settlement batch id path segments for detail requests', async () => {
    mockJsonResponse({ batch: { id: 'batch 1/2' }, items: [] });

    await aiKsApi.getSettlementDetail('admin-token', 'batch 1/2');

    expect(globalThis.fetch).toHaveBeenCalledWith(
      `${API_BASE_URL}/admin/settlements/batch%201%2F2`,
      {
        body: undefined,
        headers: {
          Authorization: 'Bearer admin-token',
          'Content-Type': 'application/json',
        },
        method: 'GET',
      },
    );
  });
});
