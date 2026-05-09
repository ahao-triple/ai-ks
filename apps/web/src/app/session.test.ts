import { describe, expect, it } from 'vitest';
import {
  createGuestSession,
  createSignedOutSession,
  getVisibleNavItems,
  isAuthenticatedSession,
} from './session';

describe('session model', () => {
  it('starts signed out', () => {
    expect(createSignedOutSession()).toEqual({ mode: 'signed-out' });
  });

  it('marks guest mode as not authenticated', () => {
    expect(isAuthenticatedSession(createGuestSession())).toBe(false);
  });

  it('shows only earnings query for guests', () => {
    expect(getVisibleNavItems(createGuestSession()).map((item) => item.key)).toEqual([
      'query',
    ]);
  });

  it('shows account workspace for account sessions', () => {
    expect(
      getVisibleNavItems({
        account: { id: '1', readableId: '1234567', username: 'demo' },
        accessToken: 'token',
        mode: 'account',
      }).map((item) => item.key),
    ).toEqual(['query', 'account']);
  });

  it('shows operations for admin sessions', () => {
    expect(
      getVisibleNavItems({
        accessToken: 'admin-token',
        admin: {
          role: 'SUPER_ADMIN',
          username: 'admin',
        },
        mode: 'admin',
      }).map((item) => item.key),
    ).toEqual(['query', 'operations']);
  });

  it('keeps operations visible for company admin sessions', () => {
    expect(
      getVisibleNavItems({
        accessToken: 'admin-token',
        admin: {
          adminId: 'company-admin-1',
          displayName: '上海运营',
          role: 'COMPANY_ADMIN',
          username: 'company_admin',
        },
        mode: 'admin',
      }).map((item) => item.key),
    ).toEqual(['query', 'operations']);
  });

  it('shows the agent workspace for agent sessions', () => {
    expect(
      getVisibleNavItems({
        accessToken: 'agent-token',
        agent: {
          id: 'agent-1',
          invitationCode: 'AGENT1',
          username: 'agent_1',
        },
        mode: 'agent',
      }).map((item) => item.key),
    ).toEqual(['query', 'agent']);
  });
});
