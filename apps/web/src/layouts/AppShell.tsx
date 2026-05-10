import { ReactNode, useState } from 'react';

export type NavItem = {
  key: string;
  label: string;
};

export type AppShellProps = {
  items: NavItem[];
  active: string;
  onNavigate: (key: string) => void;
  title: string;
  topRight?: ReactNode;
  children: ReactNode;
};

export function AppShell(props: AppShellProps) {
  const { items, active, onNavigate, title, topRight, children } = props;
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const renderNav = (closeOnClick: boolean) => (
    <>
      <div className="app-shell-nav-title">{title}</div>
      <nav className="app-shell-nav">
        {items.map((item) => (
          <button
            type="button"
            key={item.key}
            onClick={() => {
              onNavigate(item.key);
              if (closeOnClick) setMobileNavOpen(false);
            }}
            className={
              item.key === active
                ? 'app-shell-nav-item app-shell-nav-item-active'
                : 'app-shell-nav-item'
            }
          >
            {item.label}
          </button>
        ))}
      </nav>
    </>
  );

  return (
    <div className="app-shell">
      <header className="app-shell-mobile-header">
        <button
          type="button"
          aria-label="菜单"
          className="app-shell-mobile-toggle"
          onClick={() => setMobileNavOpen(true)}
        >
          ☰
        </button>
        <span className="app-shell-mobile-title">{title}</span>
        {topRight && (
          <span className="app-shell-mobile-right">{topRight}</span>
        )}
      </header>

      {mobileNavOpen && (
        <div
          className="app-shell-mobile-overlay"
          onClick={() => setMobileNavOpen(false)}
        >
          <aside
            className="app-shell-mobile-drawer"
            onClick={(e) => e.stopPropagation()}
          >
            {renderNav(true)}
          </aside>
        </div>
      )}

      <aside className="app-shell-sidebar">{renderNav(false)}</aside>
      <main className="app-shell-main">{children}</main>
    </div>
  );
}
