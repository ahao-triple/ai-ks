import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { EcpmOperationsCenter } from './EcpmOperationsCenter';
import type { EcpmDashboardRow, EcpmUpdateJob } from '../types/api';

const job: EcpmUpdateJob = {
  actorId: 'admin-1',
  actorType: 'SUPER_ADMIN',
  createdAt: '2026-05-08T00:00:00.000Z',
  endedDataHour: '2026-05-08T03:00:00.000Z',
  errorMessage: null,
  failedCount: 1,
  finishedAt: '2026-05-08T03:05:00.000Z',
  id: 'job-1',
  itemCount: 3,
  items: [
    {
      createdAt: '2026-05-08T01:00:00.000Z',
      dataHour: '2026-05-08T01:00:00.000Z',
      errorMessage: null,
      gameAppId: 'game-app-1',
      gameId: 'game-1',
      id: 'item-1',
      jobId: 'job-1',
      kuaishouSyncJobId: 'ks-job-1',
      openId: 'open-1',
      savedCount: 2,
      skipReason: null,
      status: 'SUCCEEDED',
      updatedAt: '2026-05-08T01:05:00.000Z',
      userId: 'user-1',
    },
    {
      createdAt: '2026-05-08T02:00:00.000Z',
      dataHour: '2026-05-08T02:00:00.000Z',
      errorMessage: 'fetch failed',
      gameAppId: 'game-app-1',
      gameId: 'game-1',
      id: 'item-2',
      jobId: 'job-1',
      kuaishouSyncJobId: null,
      openId: 'open-2',
      savedCount: 0,
      skipReason: null,
      status: 'FAILED',
      updatedAt: '2026-05-08T02:05:00.000Z',
      userId: 'user-2',
    },
    {
      createdAt: '2026-05-08T03:00:00.000Z',
      dataHour: '2026-05-08T03:00:00.000Z',
      errorMessage: null,
      gameAppId: 'game-app-1',
      gameId: 'game-1',
      id: 'item-3',
      jobId: 'job-1',
      kuaishouSyncJobId: null,
      openId: 'open-3',
      savedCount: 0,
      skipReason: 'no bound user',
      status: 'PARTIAL',
      updatedAt: '2026-05-08T03:05:00.000Z',
      userId: null,
    },
  ],
  mode: 'range',
  requestedGameCount: 1,
  requestedOpenIdCount: 3,
  savedCount: 2,
  scopeId: 'game-1',
  scopeType: 'game',
  skippedCount: 1,
  startedAt: '2026-05-08T00:00:00.000Z',
  startedDataHour: '2026-05-08T01:00:00.000Z',
  status: 'PARTIAL',
  updatedAt: '2026-05-08T03:05:00.000Z',
};

const row: EcpmDashboardRow = {
  companyId: 'company-1',
  companyName: 'Company A',
  dataHour: '2026-05-08T01:00:00.000Z',
  displayAmount: { li: '300', yuan: '3.00' },
  eventCount: 2,
  gameAppId: 'game-app-1',
  gameId: 'game-1',
  gameName: 'Game A',
  openId: 'open-1',
  openIdCount: 1,
  rawCost: { li: '1000', yuan: '10.00' },
  readableId: 'readable-1',
  status: 'SUCCEEDED',
  userId: 'user-1',
  username: 'User A',
};

function renderCenter(canUpdate = true) {
  return renderToStaticMarkup(
    <EcpmOperationsCenter
      canUpdate={canUpdate}
      companies={[
        {
          id: 'company-1',
          name: 'Company A',
          balance: { li: '0', yuan: '0.00' },
        } as any,
      ]}
      games={[
        {
          id: 'game-1',
          companyId: 'company-1',
          gameAppId: 'game-app-1',
          name: 'Game A',
        } as any,
      ]}
      jobs={[job]}
      loadingAction=""
      onDashboardQuery={() => undefined}
      onJobSelect={() => undefined}
      onUpdate={() => undefined}
      rows={[row]}
      selectedJob={job}
    />,
  );
}

describe('EcpmOperationsCenter', () => {
  it('renders dashboard, update scope, and report status labels', () => {
    const markup = renderCenter();

    expect(markup).toContain('最新数据');
    expect(markup).toContain('公司');
    expect(markup).toContain('游戏');
    expect(markup).toContain('用户');
    expect(markup).toContain('open_id');
    expect(markup).toContain('成功');
    expect(markup).toContain('失败');
    expect(markup).toContain('跳过');
  });

  it('disables the update button when updates are not allowed', () => {
    const markup = renderCenter(false);

    expect(markup).toContain('disabled=""');
  });
});
