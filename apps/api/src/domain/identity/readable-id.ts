import { createHash } from 'node:crypto';

const READABLE_ID_ALPHABET = '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ';

export function generateReadableId(source: string): string {
  const digest = createHash('sha256').update(source).digest();
  let value = digest.readUInt32BE(0);
  let readableId = '';

  while (readableId.length < 7) {
    readableId += READABLE_ID_ALPHABET[value % READABLE_ID_ALPHABET.length];
    value = Math.floor(value / READABLE_ID_ALPHABET.length);
  }

  return readableId;
}
