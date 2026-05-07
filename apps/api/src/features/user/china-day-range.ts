export function resolveChinaDayRange(date?: string) {
  const day = date ?? currentChinaDate();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    throw new Error('date must use YYYY-MM-DD format');
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
