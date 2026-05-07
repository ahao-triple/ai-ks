import { afterEach, describe, expect, it, vi } from 'vitest';
import { aiKsApi } from './aiKsApi';
import { API_BASE_URL } from './api';

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
});
