import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { PlatformConfigController } from './platform-config.controller';

describe('PlatformConfigController', () => {
  it('presents platform config with money fields', async () => {
    const controller = new PlatformConfigController(createService());

    await expect(controller.get()).resolves.toMatchObject({
      displayRatioPercent: 50,
      minWithdrawal: {
        li: '10000',
        yuan: '10.00',
      },
      userSettlementRatioPercent: 100,
    });
  });

  it('parses update input and passes the super admin actor to service', async () => {
    const service = createService();
    const controller = new PlatformConfigController(service);

    await controller.update(
      {
        role: 'SUPER_ADMIN',
        username: 'admin',
      },
      {
        defaultAgentId: 'agent-default-1',
        defaultAgentRatioPercent: 5,
        directAgentRatioPercent: 10,
        displayRatioPercent: 60,
        feeRatioPercent: 5,
        minWithdrawalYuan: '20.00',
        parentAgentRatioPercent: 10,
        userSettlementRatioPercent: 70,
      },
    );

    expect(service.lastUpdateInput).toMatchObject({
      actorId: 'admin',
      actorType: 'SUPER_ADMIN',
      defaultAgentId: 'agent-default-1',
      defaultAgentRatioPercent: 5,
      directAgentRatioPercent: 10,
      displayRatioPercent: 60,
      feeRatioPercent: 5,
      minWithdrawalLi: 20000n,
      parentAgentRatioPercent: 10,
      userSettlementRatioPercent: 70,
    });
  });

  it('rejects invalid update input before calling the service', async () => {
    const service = createService();
    const controller = new PlatformConfigController(service);

    await expect(
      controller.update(
        {
          role: 'SUPER_ADMIN',
          username: 'admin',
        },
        {
          displayRatioPercent: 50.5,
        },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(service.updateConfig).not.toHaveBeenCalled();
  });

  it('rejects company admins', async () => {
    const service = createService();
    const controller = new PlatformConfigController(service);

    await expect(
      controller.update(
        {
          adminId: 'company-admin-1',
          displayName: 'Company Admin',
          role: 'COMPANY_ADMIN',
          username: 'company_admin',
        },
        {},
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(service.updateConfig).not.toHaveBeenCalled();
  });
});

function createService() {
  const currentConfig = {
    defaultAgentId: null,
    defaultAgentRatioPercent: 0,
    directAgentRatioPercent: 0,
    displayRatioPercent: 50,
    feeRatioPercent: 0,
    minWithdrawalLi: 10000n,
    parentAgentRatioPercent: 0,
    userSettlementRatioPercent: 100,
  };
  const service = {
    getConfig: jest.fn(async () => currentConfig),
    lastUpdateInput: undefined as any,
    updateConfig: jest.fn(async (input: any) => {
      service.lastUpdateInput = input;
      return {
        ...currentConfig,
        ...input,
      };
    }),
  };

  return service as any;
}
