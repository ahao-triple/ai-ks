import type { ReactNode } from 'react';

type AuthLayoutProps = { children: ReactNode };

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <div className="auth-brand">
          <span className="brand-mark">KS</span>
          <div>
            <strong>AI-KS</strong>
            <span>收益结算后台</span>
          </div>
        </div>
        {children}
      </section>
    </main>
  );
}
