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

export function currentChinaDate(now?: Date) {
  return new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
  }).format(now ?? new Date());
}

// 看板查询的日期范围（颗粒度天）。
// startDay / endDay 都接受 YYYY-MM-DD，缺省 = 当天 ~ 当天。
export function resolveDashboardDayRange(input: {
  startDay?: string;
  endDay?: string;
}) {
  const today = currentChinaDate();
  const startDay = input.startDay ?? today;
  const endDay = input.endDay ?? today;
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(startDay) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(endDay)
  ) {
    throw new BadRequestException('start / end 必须是 YYYY-MM-DD');
  }
  const startAt = new Date(`${startDay}T00:00:00+08:00`);
  const endExclusive = new Date(
    new Date(`${endDay}T00:00:00+08:00`).getTime() + 24 * 60 * 60 * 1000,
  );
  if (Number.isNaN(startAt.getTime()) || Number.isNaN(endExclusive.getTime())) {
    throw new BadRequestException('start / end 日期无效');
  }
  if (startAt.getTime() >= endExclusive.getTime()) {
    throw new BadRequestException('start 必须早于或等于 end');
  }
  return { startAt, endAt: endExclusive, startDay, endDay };
}
