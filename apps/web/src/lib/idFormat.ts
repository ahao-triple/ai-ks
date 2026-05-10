const READABLE_SEGMENT = /^[0-9A-Z]{7}$/i;

export function formatUserId(raw: string): string {
  if (!raw) return raw;
  const stripped = raw.replace(/^U-/i, '').toUpperCase();
  if (READABLE_SEGMENT.test(stripped)) return `U-${stripped}`;
  return raw;
}

export function formatAccountId(raw: string): string {
  if (!raw) return raw;
  const stripped = raw.replace(/^U-/i, '').toUpperCase();
  if (READABLE_SEGMENT.test(stripped)) return stripped;
  return raw;
}

export function formatAgentInvitationCode(raw: string): string {
  if (!raw) return raw;
  if (/^L-[0-9A-Z]{6}$/i.test(raw)) return raw.toUpperCase();
  if (/^[0-9A-Z]{6}$/i.test(raw)) return `L-${raw.toUpperCase()}`;
  return raw;
}
