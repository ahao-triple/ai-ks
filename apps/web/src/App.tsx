import { useState } from 'react';
import {
  Banknote,
  Building2,
  Gamepad2,
  Gauge,
  HandCoins,
  type LucideIcon,
  Settings,
  ShieldCheck,
  Users,
} from 'lucide-react';

type WorkspaceRole = '用户' | '代理' | '公司管理员' | '超级管理员';

type NavItem = {
  label: string;
  icon: LucideIcon;
};

type Metric = {
  label: string;
  value: string;
  hint: string;
};

type WorkspaceCopy = {
  eyebrow: string;
  title: string;
  action: string;
  metrics: Metric[];
  queue: Array<{
    type: string;
    scope: string;
    status: '正常' | '预警' | '待审' | '失败';
  }>;
};

const navByRole: Record<WorkspaceRole, NavItem[]> = {
  用户: [
    { label: '收益查询', icon: Gauge },
    { label: 'ID 绑定', icon: Gamepad2 },
    { label: '提现记录', icon: Banknote },
  ],
  代理: [
    { label: '收益概览', icon: HandCoins },
    { label: '名下用户', icon: Users },
    { label: '收款信息', icon: Banknote },
  ],
  公司管理员: [
    { label: '游戏数据', icon: Gamepad2 },
    { label: '结算审核', icon: ShieldCheck },
    { label: '提现审核', icon: Banknote },
  ],
  超级管理员: [
    { label: '全局概览', icon: Gauge },
    { label: '公司与游戏', icon: Building2 },
    { label: '代理配置', icon: Users },
    { label: '系统配置', icon: Settings },
  ],
};

const workspaceByRole: Record<WorkspaceRole, WorkspaceCopy> = {
  用户: {
    eyebrow: '用户工作台',
    title: '游戏收益查询',
    action: '绑定 ID',
    metrics: [
      { label: '今日展示金额', value: '¥ 186.42', hint: '默认当天 00:00-24:00' },
      { label: '可提现金额', value: '¥ 820.10', hint: '按游戏汇总展示' },
      { label: '已绑定游戏', value: '3', hint: '一个账号管理多个 ID' },
    ],
    queue: [
      { type: '开心消消', scope: 'open_id 已绑定', status: '正常' },
      { type: '提现申请', scope: '支付宝收款', status: '待审' },
    ],
  },
  代理: {
    eyebrow: '代理工作台',
    title: '代理收益概览',
    action: '收款信息',
    metrics: [
      { label: '今日代理收益', value: '¥ 1,240.36', hint: '按下级用户结算' },
      { label: '名下用户', value: '428', hint: '仅展示用户维度' },
      { label: '待打款金额', value: '¥ 3,518.20', hint: '随用户申请一起审核' },
    ],
    queue: [
      { type: '推广链接', scope: '全游戏可用', status: '正常' },
      { type: '打款明细', scope: '支付宝账户', status: '待审' },
    ],
  },
  公司管理员: {
    eyebrow: '公司管理员工作台',
    title: '游戏运营视图',
    action: '查看权限',
    metrics: [
      { label: '今日游戏消耗', value: '¥ 8,620.00', hint: '仅限授权游戏' },
      { label: '待审核结算', value: '42', hint: '由超级管理员分配' },
      { label: '预算预警', value: '2', hint: '余额不足暂停结算' },
    ],
    queue: [
      { type: '游戏预算', scope: '开心消消', status: '预警' },
      { type: '提现审核', scope: '授权范围', status: '待审' },
    ],
  },
  超级管理员: {
    eyebrow: '超级管理员工作台',
    title: '全局运营概览',
    action: '配置中心',
    metrics: [
      { label: '今日展示金额', value: '¥ 12,480.36', hint: '配置策略后统计' },
      { label: '待结算收益', value: '¥ 8,230.10', hint: '等待授权人员确认' },
      { label: '打款异常', value: '6', hint: '失败金额保持冻结' },
    ],
    queue: [
      { type: '游戏预算', scope: '开心消消', status: '预警' },
      { type: '平台 token', scope: '全局 MAPI', status: '正常' },
    ],
  },
};

const roles = Object.keys(navByRole) as WorkspaceRole[];

export function App() {
  const [activeRole, setActiveRole] = useState<WorkspaceRole>('超级管理员');
  const navItems = navByRole[activeRole];
  const workspace = workspaceByRole[activeRole];

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">KS</span>
          <div>
            <strong>AI-KS</strong>
            <span>运营后台</span>
          </div>
        </div>

        <div className="role-switcher" aria-label="身份预览">
          {roles.map((role) => (
            <button
              className={role === activeRole ? 'role-chip active' : 'role-chip'}
              key={role}
              onClick={() => setActiveRole(role)}
              type="button"
            >
              {role}
            </button>
          ))}
        </div>

        <nav className="nav-list" aria-label="主导航">
          {navItems.map((item, index) => {
            const Icon = item.icon;
            return (
              <a
                className={index === 0 ? 'nav-item active' : 'nav-item'}
                href="#"
                key={item.label}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </a>
            );
          })}
        </nav>
      </aside>

      <section className="content">
        <header className="topbar">
          <div>
            <p>{workspace.eyebrow}</p>
            <h1>{workspace.title}</h1>
          </div>
          <button className="primary-action" type="button">
            <Settings size={16} />
            {workspace.action}
          </button>
        </header>

        <section className="metric-grid" aria-label="关键指标">
          {workspace.metrics.map((metric) => (
            <article className="metric-card" key={metric.label}>
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
              <p>{metric.hint}</p>
            </article>
          ))}
        </section>

        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>待处理事项</h2>
              <p>{activeRole}当前重点事项</p>
            </div>
          </div>
          <div className="table">
            <div className="table-row table-head">
              <span>类型</span>
              <span>范围</span>
              <span>状态</span>
            </div>
            {workspace.queue.map((item) => (
              <div className="table-row" key={`${item.type}-${item.scope}`}>
                <span>{item.type}</span>
                <span>{item.scope}</span>
                <span className={`status ${statusClassName(item.status)}`}>
                  {item.status}
                </span>
              </div>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}

function statusClassName(status: WorkspaceCopy['queue'][number]['status']) {
  if (status === '正常') {
    return 'success';
  }

  if (status === '失败') {
    return 'danger';
  }

  return 'warning';
}
