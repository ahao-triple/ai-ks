import { describe, expect, it } from 'vitest';
import { ApiError, createHeaders, readApiErrorMessage, readResponse } from './api';

describe('readApiErrorMessage', () => {
  it('joins array messages from validation errors', () => {
    expect(readApiErrorMessage({ message: ['账号必填', '密码必填'] }, 400)).toBe(
      '账号必填；密码必填',
    );
  });

  it('uses string message from API payload', () => {
    expect(readApiErrorMessage({ message: '无权限' }, 403)).toBe('无权限');
  });

  it('maps duplicate submissions', () => {
    expect(readApiErrorMessage({}, 409)).toBe('数据已存在，请勿重复提交');
  });

  it('maps bad requests', () => {
    expect(readApiErrorMessage({}, 400)).toBe('请求参数错误，请检查输入');
  });
});

describe('readResponse', () => {
  it('returns JSON payloads when response is ok', async () => {
    const response = new Response(JSON.stringify({ ok: true }), {
      headers: { 'content-type': 'application/json' },
      status: 200,
    });

    await expect(readResponse<{ ok: boolean }>(response)).resolves.toEqual({
      ok: true,
    });
  });

  it('throws ApiError with status and message when response fails', async () => {
    const response = new Response(JSON.stringify({ message: '登录失效' }), {
      headers: { 'content-type': 'application/json' },
      status: 401,
    });

    await expect(readResponse(response)).rejects.toMatchObject({
      message: '登录失效',
      status: 401,
    });
  });
});

describe('createHeaders', () => {
  it('omits authorization for guest requests', () => {
    expect(createHeaders()).toEqual({ 'Content-Type': 'application/json' });
  });

  it('adds bearer token when provided', () => {
    expect(createHeaders('token-1')).toEqual({
      Authorization: 'Bearer token-1',
      'Content-Type': 'application/json',
    });
  });
});

describe('ApiError', () => {
  it('stores the HTTP status', () => {
    expect(new ApiError('无权限', 403).status).toBe(403);
  });
});
