export type DashboardRangeKey = 'today' | 'yesterday' | 'last3' | 'last7';

export const DASHBOARD_RANGE_OPTIONS: ReadonlyArray<{
  key: DashboardRangeKey;
  label: string;
}> = [
  { key: 'today', label: '今天' },
  { key: 'yesterday', label: '昨天' },
  { key: 'last3', label: '三天总' },
  { key: 'last7', label: '七天总' },
];

export function DashboardRangeTabs(props: {
  value: DashboardRangeKey;
  onChange: (value: DashboardRangeKey) => void;
}) {
  return (
    <div className="user-dashboard-time-filters">
      {DASHBOARD_RANGE_OPTIONS.map((opt) => (
        <button
          key={opt.key}
          type="button"
          className={
            opt.key === props.value
              ? 'user-dashboard-time user-dashboard-time-active'
              : 'user-dashboard-time'
          }
          onClick={() => props.onChange(opt.key)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
