import {
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { EcpmAdminController } from './ecpm-admin.controller';

describe('EcpmAdminController', () => {
  it('delegates company dashboard queries', async () => {
    const dependencies = createDependencies();
    const controller = createController(dependencies);

    const result = await controller.company(admin, {
      companyId: 'company-1',
      endedDataHour: '2026-05-08T15:00:00+08:00',
      page: '2',
      pageSize: '25',
      startedDataHour: '2026-05-08T14:00:00+08:00',
      status: 'PENDING',
    });

    expect(dependencies.dashboardService.queryCompany).toHaveBeenCalledWith({
      admin,
      companyId: 'company-1',
      endedDataHour: '2026-05-08T15:00:00+08:00',
      page: 2,
      pageSize: 25,
      startedDataHour: '2026-05-08T14:00:00+08:00',
      status: 'PENDING',
    });
    expect(result).toEqual(dashboardResult);
  });

  it('delegates latest dashboard queries', async () => {
    const dependencies = createDependencies();
    const controller = createController(dependencies);

    const result = await controller.latest(admin, {
      companyId: 'company-1',
      endedDataHour: '2026-05-08T15:00:00+08:00',
      page: '1',
      startedDataHour: '2026-05-08T14:00:00+08:00',
    });

    expect(dependencies.dashboardService.queryLatest).toHaveBeenCalledWith({
      admin,
      companyId: 'company-1',
      page: 1,
    });
    expect(result).toEqual(dashboardResult);
  });

  it('rejects invalid update payloads', async () => {
    const dependencies = createDependencies();
    const controller = createController(dependencies);

    await expect(
      controller.update(admin, {
        extra: true,
        mode: 'latest',
        scopeId: 'company-1',
        scopeType: 'company',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(dependencies.updateRangeService.update).not.toHaveBeenCalled();
  });

  it('allows only super admins to trigger updates', async () => {
    const dependencies = createDependencies();
    const controller = createController(dependencies);

    await expect(
      controller.update(companyAdmin, {
        mode: 'latest',
        scopeId: 'company-1',
        scopeType: 'company',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(dependencies.updateRangeService.update).not.toHaveBeenCalled();

    await controller.update(admin, {
      mode: 'range',
      scopeId: 'game-1',
      scopeType: 'game',
      startedDataHour: '2026-05-08T14:00:00+08:00',
      endedDataHour: '2026-05-08T15:00:00+08:00',
    });

    expect(dependencies.updateRangeService.update).toHaveBeenCalledWith({
      actorId: 'admin',
      actorType: 'SUPER_ADMIN',
      endedDataHour: '2026-05-08T15:00:00+08:00',
      mode: 'range',
      scopeId: 'game-1',
      scopeType: 'game',
      startedDataHour: '2026-05-08T14:00:00+08:00',
    });
  });

  it('lists update jobs', async () => {
    const dependencies = createDependencies();
    const controller = createController(dependencies);

    const result = await controller.jobs('250');

    expect(dependencies.updateJobService.listJobs).toHaveBeenCalledWith({
      limit: 100,
    });
    expect(result).toEqual(updateJobListResult);
  });

  it('returns one update job detail', async () => {
    const dependencies = createDependencies();
    const controller = createController(dependencies);

    const result = await controller.job('ecpm-job-1');

    expect(dependencies.updateJobService.findJob).toHaveBeenCalledWith(
      'ecpm-job-1',
    );
    expect(result).toEqual(updateJobDetailResult);
  });

  it('retries failed or partial update jobs for super admins', async () => {
    const dependencies = createDependencies();
    const controller = createController(dependencies);

    await expect(
      controller.retry(companyAdmin, 'ecpm-job-1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(dependencies.updateRangeService.retry).not.toHaveBeenCalled();

    const result = await controller.retry(admin, 'ecpm-job-1');

    expect(dependencies.updateRangeService.retry).toHaveBeenCalledWith(
      'ecpm-job-1',
      {
        actorId: 'admin',
        actorType: 'SUPER_ADMIN',
      },
    );
    expect(result).toEqual(updateJobDetailResult);
  });

  it('rejects invalid dashboard queries', async () => {
    const dependencies = createDependencies();
    const controller = createController(dependencies);

    await expect(
      controller.company(admin, {
        page: '0',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      controller.company(admin, {
        legacy: 'ignored',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(dependencies.dashboardService.queryCompany).not.toHaveBeenCalled();
  });

  it('does not pass hour filters to latest dashboard queries', async () => {
    const dependencies = createDependencies();
    const controller = createController(dependencies);

    await controller.latest(admin, {
      endedDataHour: '2026-05-08T15:00:00+08:00',
      gameId: 'game-1',
      pageSize: '10',
      startedDataHour: '2026-05-08T14:00:00+08:00',
    });

    expect(dependencies.dashboardService.queryLatest).toHaveBeenCalledWith({
      admin,
      gameId: 'game-1',
      pageSize: 10,
    });
  });
});

const admin = { role: 'SUPER_ADMIN' as const, username: 'admin' };

const companyAdmin = {
  adminId: 'company-admin-1',
  displayName: 'Company Admin',
  role: 'COMPANY_ADMIN' as const,
  username: 'company_admin',
};

const dashboardResult = {
  rows: [
    {
      companyId: 'company-1',
      dataHour: '2026-05-08T14:00:00+08:00',
    },
  ],
  scope: 'company' as const,
};

const updateJobListResult = {
  jobs: [
    {
      id: 'ecpm-job-1',
      status: 'PARTIAL',
    },
  ],
};

const updateJobDetailResult = {
  id: 'ecpm-job-1',
  items: [],
  status: 'PARTIAL',
};

function createController(dependencies: ReturnType<typeof createDependencies>) {
  return new EcpmAdminController(
    dependencies.dashboardService as any,
    dependencies.updateJobService as any,
    dependencies.updateRangeService as any,
  );
}

function createDependencies() {
  return {
    dashboardService: {
      queryCompany: jest.fn(async () => dashboardResult),
      queryGame: jest.fn(async () => dashboardResult),
      queryLatest: jest.fn(async () => dashboardResult),
      queryOpenId: jest.fn(async () => dashboardResult),
      queryUser: jest.fn(async () => dashboardResult),
    },
    updateJobService: {
      findJob: jest.fn(async () => updateJobDetailResult),
      listJobs: jest.fn(async () => updateJobListResult),
    },
    updateRangeService: {
      retry: jest.fn(async () => updateJobDetailResult),
      update: jest.fn(async () => updateJobDetailResult),
    },
  };
}
