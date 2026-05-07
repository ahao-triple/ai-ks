import type { HTMLAttributes } from 'react';

export type AlertTone = 'danger' | 'success';

export interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  tone?: AlertTone;
}

export function Alert({
  children,
  className,
  role = 'status',
  tone = 'success',
  ...props
}: AlertProps) {
  const classes = ['ui-alert', `ui-alert-${tone}`, className]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes} role={role} {...props}>
      {children}
    </div>
  );
}
