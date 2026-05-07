export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.trim() || '/api';

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export type RequestMethod = 'GET' | 'PATCH' | 'POST';

export function createHeaders(accessToken?: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  return headers;
}

export async function requestJson<T>(
  path: string,
  options: {
    accessToken?: string;
    body?: unknown;
    method?: RequestMethod;
  } = {},
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    headers: createHeaders(options.accessToken),
    method: options.method ?? 'GET',
  });

  return readResponse<T>(response);
}

export async function readResponse<T>(response: Response): Promise<T> {
  const payload = await readPayload(response);
  if (!response.ok) {
    throw new ApiError(readApiErrorMessage(payload, response.status), response.status);
  }

  return payload as T;
}

export async function readPayload(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    return response.text();
  }

  return response.json();
}

export function readApiErrorMessage(payload: unknown, status: number): string {
  if (payload && typeof payload === 'object' && 'message' in payload) {
    const message = (payload as { message?: unknown }).message;
    if (Array.isArray(message)) {
      return message.join('；');
    }

    if (typeof message === 'string' && message.length > 0) {
      return message;
    }
  }

  if (typeof payload === 'string' && payload.length > 0) {
    return payload;
  }

  if (status === 403) {
    return '无权限访问该操作';
  }

  if (status === 409) {
    return '数据已存在，请勿重复提交';
  }

  if (status === 400) {
    return '请求参数错误，请检查输入';
  }

  return '请求失败，请稍后重试';
}
