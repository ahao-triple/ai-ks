import type { OperationFeedbackItem } from '../../app/operationFeedback';

export type OperationFeedbackProps = {
  items: OperationFeedbackItem[];
  onClear?: () => void;
};

const statusLabels: Record<OperationFeedbackItem['status'], string> = {
  failed: '失败',
  running: '进行中',
  success: '完成',
};

function formatFeedbackTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    hour12: false,
    minute: '2-digit',
    second: '2-digit',
  });
}

export function OperationFeedback({ items, onClear }: OperationFeedbackProps) {
  const latest = items[0];

  if (!latest) {
    return null;
  }

  return (
    <section className="operation-feedback" aria-label="操作反馈">
      <div
        aria-live="polite"
        className={`operation-feedback__current operation-feedback__current--${latest.status}`}
        role={latest.status === 'failed' ? 'alert' : 'status'}
      >
        <div className="operation-feedback__current-header">
          <strong>操作反馈</strong>
          <span className="operation-feedback__status">
            {statusLabels[latest.status]}
          </span>
        </div>
        <p>{latest.message}</p>
      </div>

      <details className="operation-feedback__history">
        <summary>最近操作 {items.length}</summary>
        <ol>
          {items.map((item) => (
            <li key={item.id}>
              <span
                className={`operation-feedback__dot operation-feedback__dot--${item.status}`}
                aria-hidden="true"
              />
              <span className="operation-feedback__entry-main">
                <span>{item.message}</span>
                <time dateTime={item.updatedAt}>
                  {formatFeedbackTime(item.updatedAt)}
                </time>
              </span>
            </li>
          ))}
        </ol>
      </details>

      {onClear ? (
        <button
          className="operation-feedback__clear"
          onClick={onClear}
          type="button"
        >
          清空记录
        </button>
      ) : null}
    </section>
  );
}
