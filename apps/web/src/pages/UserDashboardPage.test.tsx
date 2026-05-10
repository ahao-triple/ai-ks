import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { UserDashboardPage, type UserDashboardData } from './UserDashboardPage';

const stubData: UserDashboardData = {
  overview: {
    todayCount: 12,
    todayAverageEcpmYuan: 39.8,
    todayMaxEcpmYuan: 56.8,
    gameCount: 3,
    accountCount: 6,
    activeGameCount: 2,
    activeAccountCount: 5,
  },
  groups: [
    {
      gameId: 'g1',
      gameName: '消消乐 Pro',
      todayCount: 8,
      todayAverageEcpmYuan: 40.5,
      totalCount: 382,
      lastActiveAt: null,
      accounts: [
        {
          accountId: 'a1',
          readableId: 'A8F3D2K',
          todayCount: 5,
          todayAverageEcpmYuan: 41.4,
          totalCount: 287,
          lastActiveAt: null,
          activeStatus: 'ACTIVE',
        },
      ],
    },
  ],
  records: {
    records: [
      {
        id: 'r1',
        todaySequence: 1,
        eventTime: '2026-05-11T13:42:11+08:00',
        ecpmYuan: 38.2,
        gameId: 'g1',
        gameName: '消消乐 Pro',
        accountId: 'a1',
        accountReadableId: 'A8F3D2K',
        source: 'kuaishou',
      },
    ],
    totalToday: 1,
    totalAll: 287,
  },
};

const noopApi = {
  getUserDashboardOverview: () => Promise.resolve(stubData.overview),
  getUserDashboardGroups: () => Promise.resolve(stubData.groups),
  getUserDashboardRecords: () => Promise.resolve(stubData.records),
};

describe('UserDashboardPage SSR', () => {
  it('用 initialData 渲染 KPI、游戏与账号、单条记录', () => {
    const markup = renderToStaticMarkup(
      <UserDashboardPage
        api={noopApi}
        userReadableId="A8F3D2K"
        initialData={stubData}
      />,
    );

    expect(markup).toContain('U-A8F3D2K');
    expect(markup).toContain('今日 ECPM 条数');
    expect(markup).toContain('12');
    expect(markup).toContain('¥ 39.80');
    expect(markup).toContain('消消乐 Pro');
    expect(markup).toContain('A8F3D2K');
    expect(markup).toContain('第 1 条 🎯');
    expect(markup).toContain('我的 ECPM 记录');
  });

  it('initialData 缺失时显示加载占位', () => {
    const markup = renderToStaticMarkup(
      <UserDashboardPage api={noopApi} userReadableId="A8F3D2K" />,
    );
    expect(markup).toContain('加载中');
    expect(markup).toContain('—');
  });

  it('groups 为空时显示绑定提示', () => {
    const empty: UserDashboardData = {
      ...stubData,
      groups: [],
    };
    const markup = renderToStaticMarkup(
      <UserDashboardPage
        api={noopApi}
        userReadableId="A8F3D2K"
        initialData={empty}
      />,
    );
    expect(markup).toContain('还没有绑定游戏');
  });

  it('记录为空时显示 EcpmRecordTable 的空引导', () => {
    const empty: UserDashboardData = {
      ...stubData,
      records: { records: [], totalToday: 0, totalAll: 0 },
    };
    const markup = renderToStaticMarkup(
      <UserDashboardPage
        api={noopApi}
        userReadableId="A8F3D2K"
        initialData={empty}
      />,
    );
    expect(markup).toContain('还没有 ECPM 记录');
  });

  it('页面 header 中包含时间筛选与立即刷新按钮', () => {
    const markup = renderToStaticMarkup(
      <UserDashboardPage
        api={noopApi}
        userReadableId="A8F3D2K"
        initialData={stubData}
      />,
    );
    expect(markup).toContain('今天');
    expect(markup).toContain('昨天');
    expect(markup).toContain('三天总');
    expect(markup).toContain('七天总');
    expect(markup).toContain('立即刷新');
  });
});
