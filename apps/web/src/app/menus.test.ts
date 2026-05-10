import { describe, expect, it } from 'vitest';
import { menusForScope, titleForScope } from './menus';

describe('menusForScope', () => {
  it('account 角色返回 看板/我的提现/资料', () => {
    expect(menusForScope('account').map((m) => m.key)).toEqual([
      'dashboard',
      'withdrawal',
      'profile',
    ]);
  });

  it('agent 角色返回 看板/我的数据/我的提现/资料', () => {
    expect(menusForScope('agent').map((m) => m.key)).toEqual([
      'dashboard',
      'mydata',
      'withdrawal',
      'profile',
    ]);
  });

  it('admin 角色返回 10 项菜单，看板在首位', () => {
    const items = menusForScope('admin');
    expect(items).toHaveLength(10);
    expect(items[0].key).toBe('dashboard');
    expect(items.map((m) => m.key)).toContain('companies');
    expect(items.map((m) => m.key)).toContain('agents');
  });

  it('company-admin 角色返回 看板/游戏列表/用户查询', () => {
    expect(menusForScope('company-admin').map((m) => m.key)).toEqual([
      'dashboard',
      'games',
      'user-search',
    ]);
  });

  it('none 角色返回空数组', () => {
    expect(menusForScope('none')).toEqual([]);
  });
});

describe('titleForScope', () => {
  it('为每个角色返回中文标题', () => {
    expect(titleForScope('account')).toBe('用户工作台');
    expect(titleForScope('agent')).toBe('代理工作台');
    expect(titleForScope('admin')).toBe('超级管理员');
    expect(titleForScope('company-admin')).toBe('公司管理员');
    expect(titleForScope('none')).toBe('');
  });
});
