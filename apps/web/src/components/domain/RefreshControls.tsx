import { useState } from 'react';

// 行级刷新按钮：触发后端调快手 API 拉"当天"数据落库，写完上层负责重拉看板。
// 不再有窗口选择（系统统一刷当天），按钮只显示 ⟳ / "同步中…"。
export function RowRefreshButton(props: {
  onRefresh: () => Promise<void>;
  label?: string;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className="row-refresh-button"
      disabled={busy}
      title={props.label ?? '刷新该行（拉当天快手数据）'}
      onClick={async () => {
        setBusy(true);
        try {
          await props.onRefresh();
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? '同步中…' : '⟳'}
    </button>
  );
}
