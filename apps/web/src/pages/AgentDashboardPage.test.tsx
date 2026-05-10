import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  AgentDashboardPage,
  type AgentDashboardData,
} from './AgentDashboardPage';

const stubData: AgentDashboardData = {
  overview: {
    invitationCode: 'AB12CD',
    directUserCount: 41,
    todayTotalAmountYuan: 124.8,
    myShareTodayYuan: 18.72,
  },
  users: [
    {
      userId: 'u1',
      readableId: 'A8F3D2K',
      todayAmountYuan: 38.5,
      todayEcpmCount: 12,
      totalAmountYuan: 612.4,
      registeredAt: new Date('2026-04-12').toISOString(),
      lastActiveAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    },
    {
      userId: 'u-idle',
      readableId: 'C2A5F33',
      todayAmountYuan: 0,
      todayEcpmCount: 0,
      totalAmountYuan: 28.5,
      registeredAt: new Date('2026-04-25').toISOString(),
      lastActiveAt: null,
    },
  ],
};

const noopApi = {
  getAgentDashboardOverview: () => Promise.resolve(stubData.overview),
  getAgentDashboardUsers: () => Promise.resolve(stubData.users),
};

describe('AgentDashboardPage SSR', () => {
  it('用 initialData 渲染身份卡 + 名下用户表', () => {
    const markup = renderToStaticMarkup(
      <AgentDashboardPage
        api={noopApi}
        agentName="李代理"
        initialData={stubData}
      />,
    );

    expect(markup).toContain('你好，李代理');
    expect(markup).toContain('代理工作台');
    expect(markup).toContain('代理身份');
    expect(markup).toContain('L-AB12CD');
    expect(markup).toContain('被代理用户');
    expect(markup).toContain('41');
    expect(markup).toContain('¥ 124.80');
    expect(markup).toContain('¥ 18.72');
    expect(markup).toContain('U-A8F3D2K');
    expect(markup).toContain('从未活跃');
  });

  it('initialData 缺失时显示加载占位', () => {
    const markup = renderToStaticMarkup(
      <AgentDashboardPage api={noopApi} agentName="X" />,
    );
    expect(markup).toContain('代理工作台');
    expect(markup).toContain('—');
    expect(markup).toContain('加载中');
  });

  it('无名下用户时显示分享邀请码引导', () => {
    const empty: AgentDashboardData = {
      ...stubData,
      users: [],
    };
    const markup = renderToStaticMarkup(
      <AgentDashboardPage api={noopApi} agentName="X" initialData={empty} />,
    );
    expect(markup).toContain('还没有名下用户');
    expect(markup).toContain('邀请码分享');
  });
});
