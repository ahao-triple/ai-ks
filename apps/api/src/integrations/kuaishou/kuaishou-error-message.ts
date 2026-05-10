const REDACTED_KEYS = [
  'access_token',
  'accessToken',
  'app_secret',
  'auth_code',
  'js_code',
  'refresh_token',
  'refreshToken',
  'secret',
  'session_key',
  'sessionKey',
  'token',
];

export function summarizeKuaishouPayload(payload: unknown) {
  const json = safeStringify(payload);
  return json.length > 1000 ? `${json.slice(0, 1000)}...` : json;
}

function safeStringify(payload: unknown) {
  try {
    return JSON.stringify(payload, (key, value) =>
      REDACTED_KEYS.includes(key) ? '[redacted]' : value,
    );
  } catch {
    return String(payload);
  }
}
