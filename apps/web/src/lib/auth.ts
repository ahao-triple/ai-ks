export const ACCOUNT_AUTH_STORAGE_KEY = 'ai-ks.accountAccessToken';
export const ADMIN_AUTH_STORAGE_KEY = 'ai-ks.adminAccessToken';
export const AGENT_AUTH_STORAGE_KEY = 'ai-ks.agentAccessToken';

export function readStoredToken(key: string): string {
  return window.localStorage.getItem(key) ?? '';
}

export function writeStoredToken(key: string, token: string): void {
  window.localStorage.setItem(key, token);
}

export function clearStoredToken(key: string): void {
  window.localStorage.removeItem(key);
}
