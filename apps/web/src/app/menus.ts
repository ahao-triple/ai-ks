import type { NavItem } from '../layouts/AppShell';

export type AuthScope =
  | 'account'
  | 'agent'
  | 'admin'
  | 'company-admin'
  | 'none';

export function menusForScope(scope: AuthScope): NavItem[] {
  switch (scope) {
    case 'account':
      return [
        { key: 'dashboard', label: '看板' },
        { key: 'withdrawal', label: '我的提现' },
        { key: 'profile', label: '资料' },
      ];
    case 'agent':
      return [
        { key: 'dashboard', label: '看板' },
        { key: 'mydata', label: '我的数据' },
        { key: 'withdrawal', label: '我的提现' },
        { key: 'profile', label: '资料' },
      ];
    case 'admin':
      return [
        { key: 'dashboard', label: '看板' },
        { key: 'companies', label: '公司管理' },
        { key: 'games', label: '游戏管理' },
        { key: 'withdrawals', label: '提现管理' },
        { key: 'agents', label: '代理管理' },
        { key: 'settlements', label: '结算管理' },
        { key: 'kuaishou', label: '快手授权' },
        { key: 'config', label: '分账与配置' },
        { key: 'permissions', label: '权限' },
        { key: 'maintenance', label: '审计与维护' },
      ];
    case 'company-admin':
      return [
        { key: 'dashboard', label: '看板' },
        { key: 'games', label: '游戏列表' },
        { key: 'user-search', label: '用户查询' },
      ];
    case 'none':
    default:
      return [];
  }
}

export function titleForScope(scope: AuthScope): string {
  switch (scope) {
    case 'account':
      return '用户工作台';
    case 'agent':
      return '代理工作台';
    case 'admin':
      return '超级管理员';
    case 'company-admin':
      return '公司管理员';
    case 'none':
    default:
      return '';
  }
}
