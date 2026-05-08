import { ForbiddenException } from '@nestjs/common';
import { WithdrawalReviewController } from './withdrawal-review.controller';

describe('WithdrawalReviewController', () => {
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

function createController(dependencies: ReturnType<typeof createDependencies>) {
  return new WithdrawalReviewController(
    dependencies.auditLogService as never,
    dependencies.withdrawalDetailService as never,
    dependencies.withdrawalPaymentService as never,
    dependencies.withdrawalReviewService as never,
  );
}

function createDependencies() {
  return {
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
