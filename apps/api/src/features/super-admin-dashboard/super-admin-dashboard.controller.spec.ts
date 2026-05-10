import { Test } from '@nestjs/testing';
import { AdminJwtGuard } from '../admin-auth/admin-jwt.guard';
import { SuperAdminGuard } from '../admin-auth/super-admin.guard';
import { UserDashboardService } from '../user-dashboard/user-dashboard.service';
import { SuperAdminDashboardController } from './super-admin-dashboard.controller';
import { SuperAdminDashboardService } from './super-admin-dashboard.service';

describe('SuperAdminDashboardController', () => {
  const overview = {
    todayCount: 1724,
    todayAverageEcpmYuan: 39.5,
    todayMaxEcpmYuan: 56.8,
    activeGameCount: 14,
    totalGameCount: 18,
    activeUserCount: 2418,
  };
  const companies = [
    {
      companyId: 'c1',
      companyName: 'XX',
      ecpmCount: 982,
      activeGameCount: 3,
      totalGameCount: 4,
      activeUserCount: 680,
      averageEcpmYuan: 42.1,
      maxEcpmYuan: 56.8,
    },
  ];
  const anomalies = { syncFailures: [], longSilent: [] };

  const service = {
    getOverview: jest.fn().mockResolvedValue(overview),
    getCompanyDistribution: jest.fn().mockResolvedValue(companies),
    getAnomalies: jest.fn().mockResolvedValue(anomalies),
    listGamesUnderCompany: jest.fn().mockResolvedValue({ company: { id: 'c1', name: 'XX' }, games: [] }),
    listUsersUnderGame: jest.fn().mockResolvedValue({ company: { id: 'c1', name: 'XX' }, game: { id: 'g1', name: 'G' }, users: [] }),
  };

  const userDashboardService = {
    listEcpmRecords: jest
      .fn()
      .mockResolvedValue({ records: [], totalToday: 0, totalAll: 0 }),
  };

  let controller: SuperAdminDashboardController;

  beforeEach(async () => {
    service.getOverview.mockClear();
    service.getCompanyDistribution.mockClear();
    service.getAnomalies.mockClear();

    const moduleRef = await Test.createTestingModule({
      controllers: [SuperAdminDashboardController],
      providers: [
        { provide: SuperAdminDashboardService, useValue: service },
        { provide: UserDashboardService, useValue: userDashboardService },
      ],
    })
      .overrideGuard(AdminJwtGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(SuperAdminGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = moduleRef.get(SuperAdminDashboardController);
  });

  it('GET /overview 透传到 service', async () => {
    const result = await controller.overview({ date: '2026-05-11' });
    expect(result).toEqual(overview);
    expect(service.getOverview).toHaveBeenCalledWith({
      range: expect.objectContaining({
        startAt: expect.any(Date),
        endAt: expect.any(Date),
      }),
    });
  });

  it('GET /companies 透传到 service', async () => {
    const result = await controller.companies({});
    expect(result).toEqual(companies);
    expect(service.getCompanyDistribution).toHaveBeenCalled();
  });

  it('GET /anomalies 透传到 service', async () => {
    const result = await controller.anomalies();
    expect(result).toEqual(anomalies);
    expect(service.getAnomalies).toHaveBeenCalled();
  });

  it('GET /companies/:companyId/games 透传 companyId 到 service', async () => {
    await controller.gamesUnderCompany('c1', {});
    expect(service.listGamesUnderCompany).toHaveBeenCalledWith({
      companyId: 'c1',
      range: expect.any(Object),
    });
  });

  it('GET /games/:gameId/users 透传 gameId 到 service', async () => {
    await controller.usersUnderGame('g1', {});
    expect(service.listUsersUnderGame).toHaveBeenCalledWith({
      gameId: 'g1',
      range: expect.any(Object),
    });
  });

  it('GET /users/:userId/records 透传到 UserDashboardService', async () => {
    await controller.userRecords('u1', { gameId: 'g1', limit: 30 });
    expect(userDashboardService.listEcpmRecords).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u1', gameId: 'g1', limit: 30 }),
    );
  });
});
