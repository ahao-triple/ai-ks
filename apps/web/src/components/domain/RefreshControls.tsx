import { useState } from 'react';

export type RefreshLookbackHours = 1 | 5 | 24 | 72 | 168;

export const REFRESH_LOOKBACK_OPTIONS: ReadonlyArray<{
  hours: RefreshLookbackHours;
  label: string;
  short: string;
}> = [
  { hours: 1, label: '最近 1 小时', short: '1h' },
  { hours: 5, label: '最近 5 小时', short: '5h' },
  { hours: 24, label: '最近 1 天', short: '1d' },
  { hours: 72, label: '最近 3 天', short: '3d' },
  { hours: 168, label: '最近 7 天（最长）', short: '7d' },
];

function shortLabelFor(hours: RefreshLookbackHours): string {
  return (
    REFRESH_LOOKBACK_OPTIONS.find((opt) => opt.hours === hours)?.short ??
    `${hours}h`
  );
}

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
  const suffix = props.hours ? ` ${shortLabelFor(props.hours)}` : '';
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
