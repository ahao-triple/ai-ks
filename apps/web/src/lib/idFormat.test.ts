import { describe, expect, it } from 'vitest';
import {
  formatAccountId,
  formatAgentInvitationCode,
  formatUserId,
} from './idFormat';

describe('formatUserId', () => {
  it('给纯 7 位 ID 加 U- 前缀', () => {
    expect(formatUserId('A8F3D2K')).toBe('U-A8F3D2K');
  });

  it('已带 U- 前缀的统一大写', () => {
    expect(formatUserId('u-a8f3d2k')).toBe('U-A8F3D2K');
  });

  it('空字符串原样返回', () => {
    expect(formatUserId('')).toBe('');
  });

  it('未识别格式原样返回', () => {
    expect(formatUserId('not-readable')).toBe('not-readable');
  });
});

describe('formatAccountId', () => {
  it('保持纯 7 位无前缀', () => {
    expect(formatAccountId('A8F3D2K')).toBe('A8F3D2K');
  });

  it('误传带 U- 前缀的也归一为无前缀', () => {
    expect(formatAccountId('U-A8F3D2K')).toBe('A8F3D2K');
  });

  it('小写归一为大写', () => {
    expect(formatAccountId('a8f3d2k')).toBe('A8F3D2K');
  });
});

describe('formatAgentInvitationCode', () => {
  it('给纯 6 位邀请码加 L- 前缀', () => {
    expect(formatAgentInvitationCode('A8F3D2')).toBe('L-A8F3D2');
  });

  it('已带 L- 前缀的统一大写', () => {
    expect(formatAgentInvitationCode('l-a8f3d2')).toBe('L-A8F3D2');
  });

  it('未识别格式原样返回', () => {
    expect(formatAgentInvitationCode('xyz')).toBe('xyz');
  });
});
