import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from './Button';

export interface DialogProps {
  children?: ReactNode;
  description?: ReactNode;
  footer?: ReactNode;
  onClose(): void;
  open: boolean;
  title: ReactNode;
}

export function Dialog({
  children,
  description,
  footer,
  onClose,
  open,
  title,
}: DialogProps) {
  if (!open) {
    return null;
  }

  return (
    <div
      className="ui-dialog-backdrop"
      onClick={onClose}
      role="presentation"
    >
      <section
        aria-modal="true"
        className="ui-dialog"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <header className="ui-dialog-header">
          <div>
            <h2 className="ui-dialog-title">{title}</h2>
            {description ? (
              <p className="ui-dialog-description">{description}</p>
            ) : null}
          </div>
          <Button
            aria-label="关闭弹窗"
            compact
            icon={<X size={14} />}
            onClick={onClose}
            variant="ghost"
          >
            关闭
          </Button>
        </header>
        <div className="ui-dialog-body">{children}</div>
        {footer ? <footer className="ui-dialog-footer">{footer}</footer> : null}
      </section>
    </div>
  );
}
