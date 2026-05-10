import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AppShell, type NavItem } from './AppShell';

const items: NavItem[] = [
  { key: 'dashboard', label: '看板' },
  { key: 'withdrawal', label: '我的提现' },
  { key: 'profile', label: '资料' },
];

describe('AppShell', () => {
  it('渲染左侧菜单全部项', () => {
    const markup = renderToStaticMarkup(
      <AppShell
        items={items}
        active="dashboard"
        onNavigate={() => {}}
        title="用户工作台"
      >
        子内容
      </AppShell>,
    );
    expect(markup).toContain('看板');
    expect(markup).toContain('我的提现');
    expect(markup).toContain('资料');
    expect(markup).toContain('子内容');
    expect(markup).toContain('用户工作台');
  });

  it('active 项有 active 样式类', () => {
    const markup = renderToStaticMarkup(
      <AppShell
        items={items}
        active="withdrawal"
        onNavigate={() => {}}
        title="t"
      >
        x
      </AppShell>,
    );
    expect(markup).toMatch(
      /class="app-shell-nav-item app-shell-nav-item-active">我的提现/,
    );
  });

  it('非 active 项不带 active 样式', () => {
    const markup = renderToStaticMarkup(
      <AppShell
        items={items}
        active="dashboard"
        onNavigate={() => {}}
        title="t"
      >
        x
      </AppShell>,
    );
    expect(markup).toMatch(/class="app-shell-nav-item">我的提现/);
  });

  it('items 为空时不渲染任何菜单按钮', () => {
    const markup = renderToStaticMarkup(
      <AppShell items={[]} active="" onNavigate={() => {}} title="t">
        x
      </AppShell>,
    );
    expect(markup).not.toContain('app-shell-nav-item');
  });

  it('topRight 仅在移动端 header 渲染', () => {
    const markup = renderToStaticMarkup(
      <AppShell
        items={items}
        active="dashboard"
        onNavigate={() => {}}
        title="t"
        topRight={<span>顶部按钮</span>}
      >
        x
      </AppShell>,
    );
    expect(markup).toContain('app-shell-mobile-right');
    expect(markup).toContain('顶部按钮');
  });
});
