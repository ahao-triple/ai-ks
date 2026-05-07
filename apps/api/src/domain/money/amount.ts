export function yuanToLi(value: string): bigint {
  const trimmed = value.trim();
  if (!/^\d+(\.\d{1,3})?$/.test(trimmed)) {
    throw new Error(
      'Amount must be a positive yuan value with up to 3 decimals',
    );
  }

  const [yuanPart, decimalPart = ''] = trimmed.split('.');
  const normalizedDecimals = decimalPart.padEnd(3, '0');
  return BigInt(yuanPart) * 1000n + BigInt(normalizedDecimals);
}

export function liToYuan(value: bigint): string {
  const sign = value < 0n ? '-' : '';
  const absolute = value < 0n ? -value : value;
  const yuan = absolute / 1000n;
  const li = absolute % 1000n;
  const cents = Number((li + 5n) / 10n)
    .toString()
    .padStart(2, '0');
  return `${sign}${yuan.toString()}.${cents}`;
}

export function percentOfLi(value: bigint, percent: number): bigint {
  if (!Number.isInteger(percent) || percent < 0 || percent > 10000) {
    throw new Error('Percent must be an integer from 0 to 10000');
  }

  return (value * BigInt(percent) + 50n) / 100n;
}
