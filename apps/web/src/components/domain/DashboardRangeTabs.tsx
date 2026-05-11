// 看板日期范围选择器（颗粒度 = 天）。
// 默认 = 当天 ~ 当天。用户可通过 [起] / [止] 两个日期框选任意范围。
// （快手 ECPM 接口的 168h 限制只约束"触发刷新拉取"那条路径，不影响这里看本地库的查询。）

export type DashboardDayRange = {
  startDay: string; // YYYY-MM-DD
  endDay: string; // YYYY-MM-DD
};

export function todayDay(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
  }).format(now);
}

export function defaultDashboardDayRange(): DashboardDayRange {
  const today = todayDay();
  return { startDay: today, endDay: today };
}

export function DateRangeInput(props: {
  value: DashboardDayRange;
  onChange: (next: DashboardDayRange) => void;
}) {
  const onStart = (v: string) =>
    props.onChange({
      ...props.value,
      startDay: v,
      // 起 > 止 时自动把止拉到起
      endDay: v > props.value.endDay ? v : props.value.endDay,
    });
  const onEnd = (v: string) =>
    props.onChange({
      ...props.value,
      endDay: v,
      startDay: v < props.value.startDay ? v : props.value.startDay,
    });

  return (
    <div className="dashboard-date-range">
      <input
        type="date"
        className="dashboard-date-input"
        value={props.value.startDay}
        onChange={(e) => onStart(e.target.value)}
        aria-label="起始日期"
      />
      <span className="dashboard-date-range-sep">~</span>
      <input
        type="date"
        className="dashboard-date-input"
        value={props.value.endDay}
        onChange={(e) => onEnd(e.target.value)}
        aria-label="截止日期"
      />
    </div>
  );
}
