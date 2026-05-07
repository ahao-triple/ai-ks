import type { MoneyValue } from '../types/api';

export function formatMoney(money?: MoneyValue): string {
  return `¥ ${money?.yuan ?? '0.00'}`;
}

export function formatDateTime(value?: string): string {
  if (!value) {
    return '-';
  }

  return new Date(value).toLocaleString();
}

export function formatAuditMetadata(metadata: unknown): string {
  if (!metadata || typeof metadata !== 'object') {
    return '-';
  }

  return Object.entries(metadata as Record<string, unknown>)
    .slice(0, 3)
    .map(([key, value]) => `${key}:${String(value)}`)
    .join(' / ');
}
