import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { aiKsApi } from './aiKsApi';
import { API_BASE_URL } from './api';
import type { AdminWithdrawalBatch } from '../types/api';

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
