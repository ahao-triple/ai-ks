import {
  CircleUserRound,
  Gauge,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';
import type { AccountResult, AdminPrincipal } from '../types/api';

export type ViewKey = 'account' | 'operations' | 'query';

export type NavItem = {
  description: string;
  icon: LucideIcon;
  key: ViewKey;
  label: string;
  subtitle: string;
};

export type AppSession =
  | { mode: 'signed-out' }
  | { mode: 'guest' }
  | { accessToken: string; account: AccountResult; mode: 'account' }
  | { accessToken: string; admin: AdminPrincipal; mode: 'admin' };

export const navItems: Record<ViewKey, NavItem> = {
  query: {
    description: '按 open_id 或可读 ID 查看当天收益',
    icon: Gauge,
    key: 'query',
    label: '收益查询',
    subtitle: '游客可用',
  },
  account: {
    description: '账号绑定、收益、支付宝与提现',
    icon: CircleUserRound,
    key: 'account',
    label: '账号工作台',
    subtitle: '用户账号',
  },
  operations: {
    description: '联调、刷新、提现审核与审计日志',
    icon: ShieldCheck,
    key: 'operations',
    label: '运营管理',
    subtitle: '管理员',
  },
};

export function createSignedOutSession(): AppSession {
  return { mode: 'signed-out' };
}

export function createGuestSession(): AppSession {
  return { mode: 'guest' };
}

export function isAuthenticatedSession(session: AppSession): boolean {
  return session.mode === 'account' || session.mode === 'admin';
}

export function getVisibleNavItems(session: AppSession): NavItem[] {
  if (session.mode === 'account') {
    return [navItems.query, navItems.account];
  }

  if (session.mode === 'admin') {
    return [navItems.query, navItems.operations];
  }

  if (session.mode === 'guest') {
    return [navItems.query];
  }

  return [];
}
