import type { HTMLAttributes } from 'react';

export type StatusBadgeTone = 'danger' | 'info' | 'muted' | 'success' | 'warning';

export interface StatusBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: StatusBadgeTone;
}

export function StatusBadge({
  children,
  className,
  tone = 'muted',
  ...props
}: StatusBadgeProps) {
  const classes = [
    'ui-status-badge',
    `ui-status-badge-${tone}`,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <span className={classes} {...props}>
      {children}
    </span>
  );
}
