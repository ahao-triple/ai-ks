import { Test } from '@nestjs/testing';
import { AccountAuthService } from '../account/account-auth.service';
import { AccountJwtGuard } from '../account/account-jwt.guard';
import { UserDashboardController } from './user-dashboard.controller';
import { UserDashboardService } from './user-dashboard.service';

describe('UserDashboardController', () => {
  const mockOverview = {
    todayCount: 12,
    todayAverageEcpmYuan: 39.8,
    todayMaxEcpmYuan: 56.8,
    gameCount: 3,
    accountCount: 6,
    activeGameCount: 2,
    activeAccountCount: 5,
  };

  const service = {
    getOverview: jest.fn().mockResolvedValue(mockOverview),
    getGameAccountGroups: jest.fn().mockResolvedValue([]),
    listEcpmRecords: jest
      .fn()
      .mockResolvedValue({ records: [], totalToday: 0, totalAll: 0 }),
  };

  let controller: UserDashboardController;

  beforeEach(async () => {
    service.getOverview.mockClear();
    service.getGameAccountGroups.mockClear();
    service.listEcpmRecords.mockClear();

    const moduleRef = await Test.createTestingModule({
      controllers: [UserDashboardController],
      providers: [
        { provide: UserDashboardService, useValue: service },
        { provide: AccountAuthService, useValue: { verifyAccessToken: jest.fn() } },
      ],
    })
      .overrideGuard(AccountJwtGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = moduleRef.get(UserDashboardController);
  });

  const account = { id: 'u1', readableId: 'A8F3D2K', username: 'alice' } as never;

  it('GET /overview 透传到 service.getOverview', async () => {
    const result = await controller.overview(account, { date: '2026-05-11' });
    expect(result).toEqual(mockOverview);
    expect(service.getOverview).toHaveBeenCalledWith({
      userId: 'u1',
      range: expect.objectContaining({ startAt: expect.any(Date), endAt: expect.any(Date) }),
    });
  });

  it('GET /groups 透传到 service.getGameAccountGroups', async () => {
    await controller.groups(account, { date: '2026-05-11' });
    expect(service.getGameAccountGroups).toHaveBeenCalledWith({
      userId: 'u1',
      range: expect.objectContaining({ startAt: expect.any(Date) }),
    });
  });

  it('GET /records 透传 gameId / accountId / limit 给 service.listEcpmRecords', async () => {
    await controller.records(account, {
      date: '2026-05-11',
      gameId: 'g1',
      accountId: 'a1',
      limit: 30,
    });
    expect(service.listEcpmRecords).toHaveBeenCalledWith({
      userId: 'u1',
      range: expect.objectContaining({ startAt: expect.any(Date) }),
      gameId: 'g1',
      accountId: 'a1',
      limit: 30,
    });
  });

  it('未提供 limit 时使用默认 50', async () => {
    await controller.records(account, {});
    expect(service.listEcpmRecords).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 50 }),
    );
  });

  it('limit 超过 200 时抛错', async () => {
    await expect(controller.records(account, { limit: 999 })).rejects.toThrow();
  });
});
