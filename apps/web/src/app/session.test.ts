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
        adminName: 'admin',
        mode: 'admin',
      }).map((item) => item.key),
    ).toEqual(['query', 'operations']);
  });
});
