import { describe, expect, it } from 'vitest';
import { formatAuditMetadata, formatDateTime, formatMoney } from './format';

describe('formatMoney', () => {
  it('formats missing money as yuan zero', () => {
    expect(formatMoney()).toBe('¥ 0.00');
  });

  it('formats the yuan string from API money values', () => {
    expect(formatMoney({ li: '1234', yuan: '123.40' })).toBe('¥ 123.40');
  });
});

describe('formatDateTime', () => {
  it('formats ISO timestamps with the local date and time text', () => {
    expect(formatDateTime('2026-05-08T01:02:03.000Z')).toContain('2026');
  });

  it('returns dash for missing timestamps', () => {
    expect(formatDateTime()).toBe('-');
  });
});

describe('formatAuditMetadata', () => {
  it('returns dash for missing metadata', () => {
    expect(formatAuditMetadata(null)).toBe('-');
  });

  it('prints at most three metadata entries', () => {
    expect(
      formatAuditMetadata({ a: 1, b: 'two', c: true, d: 'hidden' }),
    ).toBe('a:1 / b:two / c:true');
  });
});
