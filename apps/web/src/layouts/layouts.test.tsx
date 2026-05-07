import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createGuestSession } from '../app/session';
import { AuthLayout } from './AuthLayout';
import { DashboardLayout } from './DashboardLayout';

describe('layouts', () => {
  it('renders auth layout without dashboard navigation', () => {
    const html = renderToStaticMarkup(<AuthLayout>登录表单</AuthLayout>);
    expect(html).toContain('登录表单');
    expect(html).not.toContain('主导航');
  });

  it('renders dashboard layout with guest navigation only', () => {
    const html = renderToStaticMarkup(
      <DashboardLayout
        activeView="query"
        modeText="快手 Mock"
        onNavigate={() => undefined}
        onSignOut={() => undefined}
        session={createGuestSession()}
      >
        查询页面
      </DashboardLayout>,
    );

    expect(html).toContain('收益查询');
    expect(html).toContain('查询页面');
    expect(html).not.toContain('账号工作台');
  });
});
