export type EcpmRecordView = {
  todaySequence: number;
  eventTimeIso: string;
  ecpmYuan: number;
  gameName: string;
  accountReadableId: string;
  source: string;
  displayAmountYuan?: number;
  status?: string;
  errorReason?: string;
};

export type EcpmRecordExtraColumn =
  | 'displayAmount'
  | 'status'
  | 'errorReason';

export type EcpmRecordTableProps = {
  rows: EcpmRecordView[];
  loading: boolean;
  totalToday: number;
  totalAll: number;
  extraColumns?: EcpmRecordExtraColumn[];
  emptyHint?: string;
};

const SKELETON_COUNT = 4;

export function EcpmRecordTable(props: EcpmRecordTableProps) {
  const { rows, loading, totalToday, totalAll, extraColumns = [] } = props;

  if (loading && rows.length === 0) {
    return (
      <div className="ecpm-record-skeleton" role="status" aria-busy>
        {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
          <div key={i} className="ecpm-record-skeleton-row" role="status" />
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="ecpm-record-empty">
        <div className="ecpm-record-empty-emoji">📭</div>
        <div className="ecpm-record-empty-title">还没有 ECPM 记录</div>
        <div className="ecpm-record-empty-hint">
          {props.emptyHint ?? '绑定一个游戏并在游戏内看广告后，记录会出现在这里。'}
        </div>
      </div>
    );
  }

  return (
    <div className="ecpm-record-table-wrap">
      <div className="ecpm-record-counter">
        今日 <strong>{totalToday}</strong> 条 · 累计 <strong>{totalAll}</strong> 条
      </div>
      {/* 桌面版：完整表格 */}
      <div className="ecpm-record-table-desktop">
        <table className="ecpm-record-table">
          <thead>
            <tr>
              <th>今日序号</th>
              <th>时间（精确到秒）</th>
              <th className="ecpm-record-col-num">ECPM</th>
              <th>游戏</th>
              <th>账号</th>
              {extraColumns.includes('displayAmount') && (
                <th className="ecpm-record-col-num">展示金额</th>
              )}
              {extraColumns.includes('status') && <th>入账状态</th>}
              {extraColumns.includes('errorReason') && <th>异常原因</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.todaySequence}-${row.eventTimeIso}-${row.accountReadableId}`}>
                <td>{renderSequence(row.todaySequence)}</td>
                <td className="ecpm-record-mono">{formatEventTime(row.eventTimeIso)}</td>
                <td className="ecpm-record-col-num">{formatEcpm(row.ecpmYuan)}</td>
                <td>{row.gameName}</td>
                <td className="ecpm-record-mono">{row.accountReadableId}</td>
                {extraColumns.includes('displayAmount') && (
                  <td className="ecpm-record-col-num">
                    {row.displayAmountYuan != null
                      ? `¥ ${row.displayAmountYuan.toFixed(2)}`
                      : '—'}
                  </td>
                )}
                {extraColumns.includes('status') && <td>{row.status ?? '—'}</td>}
                {extraColumns.includes('errorReason') && (
                  <td>{row.errorReason ?? '—'}</td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 移动端：卡片堆叠 */}
      <div className="ecpm-record-table-mobile">
        {rows.map((row) => (
          <div
            className="ecpm-record-card"
            key={`m-${row.todaySequence}-${row.eventTimeIso}-${row.accountReadableId}`}
          >
            <div>
              <div className="ecpm-record-card-seq">
                {renderSequence(row.todaySequence)}
              </div>
              <div className="ecpm-record-mono ecpm-record-card-time">
                {formatEventTime(row.eventTimeIso)}
              </div>
            </div>
            <div className="ecpm-record-card-right">
              <div className="ecpm-record-card-ecpm">
                {formatEcpm(row.ecpmYuan)}
              </div>
              <div className="ecpm-record-card-meta">
                {row.gameName} · {row.accountReadableId}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function renderSequence(seq: number) {
  if (seq === 1) {
    return <span className="ecpm-record-first">第 1 条 🎯</span>;
  }
  return <span className="ecpm-record-seq">第 {seq} 条</span>;
}

function formatEcpm(value: number): string {
  return `¥ ${value.toFixed(2)}`;
}

function formatEventTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
