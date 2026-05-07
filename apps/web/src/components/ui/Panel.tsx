import type { ReactNode } from 'react';

export interface PanelProps {
  actions?: ReactNode;
  children?: ReactNode;
  description?: ReactNode;
  title: ReactNode;
}

export function Panel({ actions, children, description, title }: PanelProps) {
  return (
    <section className="ui-panel">
      <header className="ui-panel-header">
        <div>
          <h2 className="ui-panel-title">{title}</h2>
          {description ? (
            <p className="ui-panel-description">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="ui-panel-actions">{actions}</div> : null}
      </header>
      <div className="ui-panel-body">{children}</div>
    </section>
  );
}
