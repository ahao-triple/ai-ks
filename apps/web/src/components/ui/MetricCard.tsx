import type { ReactNode } from 'react';

export interface MetricCardProps {
  detail?: ReactNode;
  label: ReactNode;
  value: ReactNode;
}

export function MetricCard({ detail, label, value }: MetricCardProps) {
  return (
    <article className="ui-metric-card">
      <div className="ui-metric-label">{label}</div>
      <div className="ui-metric-value">{value}</div>
      {detail ? <div className="ui-metric-detail">{detail}</div> : null}
    </article>
  );
}
