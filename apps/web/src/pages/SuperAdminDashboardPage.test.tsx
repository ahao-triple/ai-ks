import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  SuperAdminDashboardPage,
  type SuperAdminDashboardData,
} from './SuperAdminDashboardPage';

const stubData: SuperAdminDashboardData = {
  overview: {
    todayCount: 1724,
    todayAverageEcpmYuan: 39.5,
    todayMaxEcpmYuan: 56.8,
    activeGameCount: 14,
    totalGameCount: 18,
    activeUserCount: 2418,
  },
  companies: [
    {
      companyId: 'c1',
      companyName: 'XX 互娱',
      ecpmCount: 982,
      activeGameCount: 3,
      totalGameCount: 4,
      activeUserCount: 680,
      averageEcpmYuan: 42.1,
      maxEcpmYuan: 56.8,
    },
    {
      companyId: 'c2',
      companyName: 'YY 网络',
      ecpmCount: 0,
      activeGameCount: 0,
      totalGameCount: 1,
      activeUserCount: 0,
      averageEcpmYuan: 0,
      maxEcpmYuan: 0,
    },
  ],
  anomalies: {
    syncFailures: [
      {
        gameAppId: 'app1',
        gameName: '消消乐 Pro',
        jobId: 'job-1',
        failedAt: new Date().toISOString(),
        errorMessage: '认证失败',
      },
    ],
    longSilent: [
      { gameId: 'g2', gameName: '合成大西瓜 mini', hoursSinceLastEcpm: 8.5 },
    ],
  },
};

const noopApi = {
  getSuperAdminDashboardOverview: () => Promise.resolve(stubData.overview),
  getSuperAdminDashboardCompanies: () => Promise.resolve(stubData.companies),
  getSuperAdminDashboardAnomalies: () => Promise.resolve(stubData.anomalies),
  getSuperAdminGamesUnderCompany: () =>
    Promise.resolve({
      company: { id: 'c1', name: 'XX 互娱' },
      games: [],
    }),
  getSuperAdminUsersUnderGame: () =>
    Promise.resolve({
      company: { id: 'c1', name: 'XX 互娱' },
      game: { id: 'g1', name: 'G' },
      users: [],
    }),
  getSuperAdminUserRecords: () =>
    Promise.resolve({ records: [], totalToday: 0, totalAll: 0 }),
};

describe('SuperAdminDashboardPage SSR', () => {
  it('用 initialData 渲染 KPI / 公司分布 / 异常', () => {
    const markup = renderToStaticMarkup(
      <SuperAdminDashboardPage api={noopApi} initialData={stubData} />,
    );

    expect(markup).toContain('全平台看板');
    expect(markup).toContain('今日 ECPM 条数');
    expect(markup).toContain('1,724');
    expect(markup).toContain('XX 互娱');
    expect(markup).toContain('982');
    expect(markup).toContain('同步失败');
    expect(markup).toContain('长时间无数据');
    expect(markup).toContain('消消乐 Pro');
  });

  it('initialData 缺失时显示加载占位', () => {
    const markup = renderToStaticMarkup(
      <SuperAdminDashboardPage api={noopApi} />,
    );
    expect(markup).toContain('加载中');
  });

  it('无异常时显示"其它暂无异常"', () => {
    const empty: SuperAdminDashboardData = {
      ...stubData,
      anomalies: { syncFailures: [], longSilent: [] },
    };
    const markup = renderToStaticMarkup(
      <SuperAdminDashboardPage api={noopApi} initialData={empty} />,
    );
    expect(markup).toContain('其它暂无异常');
  });

  it('无公司数据时显示空提示', () => {
    const empty: SuperAdminDashboardData = {
      ...stubData,
      companies: [],
    };
    const markup = renderToStaticMarkup(
      <SuperAdminDashboardPage api={noopApi} initialData={empty} />,
    );
    expect(markup).toContain('还没有公司或无 ECPM 数据');
  });
});
