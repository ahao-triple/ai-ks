import { Test } from '@nestjs/testing';
import { AgentJwtGuard } from '../agent/agent-jwt.guard';
import { AgentDashboardController } from './agent-dashboard.controller';
import { AgentDashboardService } from './agent-dashboard.service';

describe('AgentDashboardController', () => {
  const overview = {
    invitationCode: 'AB12CD',
    directUserCount: 5,
    todayTotalAmountYuan: 124.8,
    myShareTodayYuan: 18.72,
  };
  const users = [
    {
      userId: 'u1',
      readableId: 'A8F3D2K',
      todayAmountYuan: 22.6,
      todayEcpmCount: 2,
      totalAmountYuan: 56.6,
      registeredAt: new Date('2026-04-01'),
      lastActiveAt: new Date('2026-05-11T14:00:00+08:00'),
    },
  ];

  const service = {
    getOverview: jest.fn().mockResolvedValue(overview),
    listUnderUsers: jest.fn().mockResolvedValue(users),
  };

  let controller: AgentDashboardController;

  beforeEach(async () => {
    service.getOverview.mockClear();
    service.listUnderUsers.mockClear();

    const moduleRef = await Test.createTestingModule({
      controllers: [AgentDashboardController],
      providers: [{ provide: AgentDashboardService, useValue: service }],
    })
      .overrideGuard(AgentJwtGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = moduleRef.get(AgentDashboardController);
  });

  const agent = { id: 'a1', invitationCode: 'AB12CD' } as never;

  it('GET /overview 透传到 service', async () => {
    const result = await controller.overview(agent, { date: '2026-05-11' });
    expect(result).toEqual(overview);
    expect(service.getOverview).toHaveBeenCalledWith({
      agentId: 'a1',
      range: expect.objectContaining({ startAt: expect.any(Date) }),
    });
  });

  it('GET /users 透传到 service', async () => {
    const result = await controller.users(agent, {});
    expect(result).toEqual(users);
    expect(service.listUnderUsers).toHaveBeenCalled();
  });
});
