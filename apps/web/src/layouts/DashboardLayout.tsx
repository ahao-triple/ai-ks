import { LogOut } from 'lucide-react';
import type { ReactNode } from 'react';
import {
  getVisibleNavItems,
  navItems,
  type AppSession,
  type ViewKey,
} from '../app/session';
import { Button, StatusBadge } from '../components/ui';

type DashboardLayoutProps = {
  activeView: ViewKey;
  children: ReactNode;
  modeText: string;
  onNavigate(view: ViewKey): void;
  onSignOut(): void;
  session: AppSession;
};

export function DashboardLayout({
  activeView,
  children,
  modeText,
  onNavigate,
  onSignOut,
  session,
}: DashboardLayoutProps) {
  const activeMeta = navItems[activeView];
  const visibleNavItems = getVisibleNavItems(session);

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">KS</span>
          <div>
            <strong>AI-KS</strong>
            <span>收益结算后台</span>
          </div>
        </div>

        <nav aria-label="主导航" className="nav-list">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;

            return (
              <button
                className={
                  item.key === activeView ? 'nav-item active' : 'nav-item'
                }
                key={item.key}
                onClick={() => onNavigate(item.key)}
                type="button"
              >
                <Icon size={18} />
                <span>{item.label}</span>
                <small>{item.subtitle}</small>
              </button>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <span>接口环境</span>
          <strong>{modeText}</strong>
          <small>
            {session.mode === 'guest'
              ? '游客仅可查询单个 ID'
              : '以后端授权结果为准'}
          </small>
        </div>
      </aside>

      <section className="content">
        <header className="topbar">
          <div>
            <p>{activeMeta.subtitle}</p>
            <h1>{activeMeta.label}</h1>
            <span>{activeMeta.description}</span>
          </div>
          <div className="topbar-actions">
            <SessionBadge session={session} />
            <StatusBadge tone="info">{modeText}</StatusBadge>
            <Button
              compact
              icon={<LogOut size={16} />}
              onClick={onSignOut}
              variant="ghost"
            >
              退出
            </Button>
          </div>
        </header>

        {children}
      </section>
    </main>
  );
}

function SessionBadge({ session }: { session: AppSession }) {
  if (session.mode === 'account') {
    return <StatusBadge tone="muted">{session.account.username}</StatusBadge>;
  }

  if (session.mode === 'admin') {
    return (
      <StatusBadge tone="muted">
        {session.admin.role === 'COMPANY_ADMIN'
          ? session.admin.displayName
          : session.admin.username}
      </StatusBadge>
    );
  }

  if (session.mode === 'agent') {
    return <StatusBadge tone="muted">{session.agent.username}</StatusBadge>;
  }

  if (session.mode === 'guest') {
    return <StatusBadge tone="warning">游客</StatusBadge>;
  }

  return null;
}
