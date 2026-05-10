import { useState } from 'react';

export type RefreshLookbackHours = 1 | 3 | 6 | 12 | 24 | 168;

export const REFRESH_LOOKBACK_OPTIONS: ReadonlyArray<{
  hours: RefreshLookbackHours;
  label: string;
}> = [
  { hours: 1, label: '近 1 小时' },
  { hours: 3, label: '近 3 小时' },
  { hours: 6, label: '近 6 小时' },
  { hours: 12, label: '近 12 小时' },
  { hours: 24, label: '近 24 小时' },
  { hours: 168, label: '近 7 天（168 小时，最长）' },
];

export function RefreshWindowSelect(props: {
  value: RefreshLookbackHours;
  onChange: (value: RefreshLookbackHours) => void;
  disabled?: boolean;
}) {
  return (
    <label className="refresh-window-select">
      刷新窗口
      <select
        value={props.value}
        disabled={props.disabled}
        onChange={(event) =>
          props.onChange(Number(event.target.value) as RefreshLookbackHours)
        }
      >
        {REFRESH_LOOKBACK_OPTIONS.map((opt) => (
          <option key={opt.hours} value={opt.hours}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function RowRefreshButton(props: {
  onRefresh: () => Promise<void>;
  hours?: RefreshLookbackHours;
  label?: string;
}) {
  const [busy, setBusy] = useState(false);
  const suffix = props.hours ? ` ${props.hours}h` : '';
  return (
    <button
      type="button"
      className="row-refresh-button"
      disabled={busy}
      title={props.label ?? `刷新该行 ECPM${suffix ? `（${suffix.trim()}）` : ''}`}
      onClick={async () => {
        setBusy(true);
        try {
          await props.onRefresh();
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? `同步中${suffix}…` : `⟳${suffix}`}
    </button>
  );
}
