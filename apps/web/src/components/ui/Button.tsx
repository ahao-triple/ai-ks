import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type ButtonVariant = 'danger' | 'ghost' | 'primary' | 'secondary';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  compact?: boolean;
  icon?: ReactNode;
  variant?: ButtonVariant;
}

export function Button({
  children,
  className,
  compact = false,
  icon,
  type = 'button',
  variant = 'primary',
  ...props
}: ButtonProps) {
  const classes = [
    'ui-button',
    `ui-button-${variant}`,
    compact ? 'ui-button-compact' : undefined,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button className={classes} type={type} {...props}>
      {icon ? <span className="ui-button-icon">{icon}</span> : null}
      {children}
    </button>
  );
}
