import { BadRequestException } from '@nestjs/common';

export function resolveChinaDayRange(date?: string) {
  const day = date ?? currentChinaDate();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    throw new BadRequestException('date 必须使用 YYYY-MM-DD 格式');
  }

  const startAt = new Date(`${day}T00:00:00+08:00`);
  const endAt = new Date(startAt.getTime() + 24 * 60 * 60 * 1000);

  return {
    day,
    startAt,
    endAt,
  };
}

function currentChinaDate() {
  return new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
  }).format(new Date());
}

// 看板时间筛选 tab：今天 / 昨天 / 三天总 / 七天总（"总"= 累计含今天）。
export type DashboardRangeKey = 'today' | 'yesterday' | 'last3' | 'last7';

const DASHBOARD_RANGE_KEYS: ReadonlySet<DashboardRangeKey> = new Set([
  'today',
  'yesterday',
  'last3',
  'last7',
]);

export function isDashboardRangeKey(value: unknown): value is DashboardRangeKey {
  return (
    typeof value === 'string' &&
    DASHBOARD_RANGE_KEYS.has(value as DashboardRangeKey)
  );
}

export function resolveDashboardRange(key: DashboardRangeKey) {
  const today = currentChinaDate();
  const todayStart = new Date(`${today}T00:00:00+08:00`);
  const dayMs = 24 * 60 * 60 * 1000;

  switch (key) {
    case 'today':
      return {
        startAt: todayStart,
        endAt: new Date(todayStart.getTime() + dayMs),
      };
    case 'yesterday':
      return {
        startAt: new Date(todayStart.getTime() - dayMs),
        endAt: todayStart,
      };
    case 'last3':
      return {
        startAt: new Date(todayStart.getTime() - 2 * dayMs),
        endAt: new Date(todayStart.getTime() + dayMs),
      };
    case 'last7':
      return {
        startAt: new Date(todayStart.getTime() - 6 * dayMs),
        endAt: new Date(todayStart.getTime() + dayMs),
      };
  }
}
