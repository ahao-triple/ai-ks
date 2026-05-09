import { ForbiddenException } from '@nestjs/common';
import { WithdrawalReviewController } from './withdrawal-review.controller';

describe('WithdrawalReviewController', () => {
  it('passes resolved read scope when listing withdrawals', async () => {
    const dependencies = createDependencies();
    const controller = createController(dependencies);

    dependencies.adminAccessControlService.resolveReadScope.mockResolvedValue(
      superAdminReadScope,
    );
    dependencies.withdrawalReviewService.listBatches.mockResolvedValue([]);

    await expect(
      controller.list(superAdmin, 'PENDING_REVIEW'),
    ).resolves.toEqual({
      batches: [],
    });

    expect(
      dependencies.adminAccessControlService.resolveReadScope,
    ).toHaveBeenCalledWith(superAdmin);
    expect(dependencies.withdrawalReviewService.listBatches).toHaveBeenCalledWith(
      {
        readScope: superAdminReadScope,
        status: 'PENDING_REVIEW',
      },
    );
  });

  it('passes resolved read scope when returning withdrawal detail', async () => {
    const dependencies = createDependencies();
    const controller = createController(dependencies);

    dependencies.adminAccessControlService.resolveReadScope.mockResolvedValue(
      superAdminReadScope,
    );
    dependencies.withdrawalDetailService.getBatchDetail.mockResolvedValue({
      auditLogs: [],
      batch: createBatch(),
    });

    await controller.detail(superAdmin, 'batch-1');

    expect(
      dependencies.adminAccessControlService.resolveReadScope,
    ).toHaveBeenCalledWith(superAdmin);
    expect(
      dependencies.withdrawalDetailService.getBatchDetail,
    ).toHaveBeenCalledWith({
      batchId: 'batch-1',
      readScope: superAdminReadScope,
    });
  });

  it('rejects company admins before approving withdrawals', async () => {
    const dependencies = createDependencies();
    const controller = createController(dependencies);

    await expect(
      controller.approve(companyAdmin, 'batch-1'),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(
      dependencies.withdrawalReviewService.approveBatch,
    ).not.toHaveBeenCalled();
    expect(dependencies.auditLogService.record).not.toHaveBeenCalled();
  });

  it('rejects company admins before paying withdrawals', async () => {
    const dependencies = createDependencies();
    const controller = createController(dependencies);

    await expect(
      controller.pay(companyAdmin, 'batch-1', { mockResult: 'success' }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(
      dependencies.withdrawalPaymentService.payBatch,
    ).not.toHaveBeenCalled();
    expect(dependencies.auditLogService.record).not.toHaveBeenCalled();
  });

  it('rejects company admins before closing withdrawals', async () => {
    const dependencies = createDependencies();
    const controller = createController(dependencies);

    await expect(
      controller.close(companyAdmin, 'batch-1'),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(
      dependencies.withdrawalPaymentService.closeFailedBatch,
    ).not.toHaveBeenCalled();
    expect(dependencies.auditLogService.record).not.toHaveBeenCalled();
  });
});

const companyAdmin = {
  adminId: 'company-admin-1',
  displayName: 'Company Admin',
  role: 'COMPANY_ADMIN' as const,
  username: 'company_admin',
};

const superAdmin = {
  adminId: 'super-admin-1',
  displayName: 'Super Admin',
  role: 'SUPER_ADMIN' as const,
  username: 'super_admin',
};

const superAdminReadScope = {
  companyIds: undefined,
  gameAppIds: undefined,
  gameIds: undefined,
  isSuperAdmin: true,
};

function createController(dependencies: ReturnType<typeof createDependencies>) {
  return new WithdrawalReviewController(
    dependencies.adminAccessControlService as never,
    dependencies.auditLogService as never,
    dependencies.withdrawalDetailService as never,
    dependencies.withdrawalPaymentService as never,
    dependencies.withdrawalReviewService as never,
  );
}

function createDependencies() {
  return {
    adminAccessControlService: {
      resolveReadScope: jest.fn(),
    },
    auditLogService: {
      record: jest.fn(async () => undefined),
    },
    withdrawalDetailService: {
      getBatchDetail: jest.fn(),
    },
    withdrawalPaymentService: {
      closeFailedBatch: jest.fn(),
      payBatch: jest.fn(),
    },
    withdrawalReviewService: {
      approveBatch: jest.fn(),
      listBatches: jest.fn(),
    },
  };
}

function createBatch() {
  return {
    id: 'batch-1',
    createdAt: new Date('2026-05-07T01:00:00.000Z'),
    details: [],
    status: 'PENDING_REVIEW',
    totalAmountLi: 3000n,
    updatedAt: new Date('2026-05-07T01:00:00.000Z'),
    userId: 'user-1',
  };
}
