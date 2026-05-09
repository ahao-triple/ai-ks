import { BadRequestException, ForbiddenException } from '@nestjs/common';
import {
  SettlementAdminController,
  parseSettlementRange,
} from './settlement-admin.controller';

describe('parseSettlementRange', () => {
  it('parses date-only ranges into full-day UTC bounds', () => {
    expect(
      parseSettlementRange({
        endDate: '2026-05-08',
        gameId: 'game-1',
        startDate: '2026-05-08',
      }),
    ).toEqual({
      endedAt: new Date('2026-05-08T23:59:59.999Z'),
      gameId: 'game-1',
      startedAt: new Date('2026-05-08T00:00:00.000Z'),
      userId: undefined,
    });
  });

  it('trims valid padded game and user ids', () => {
    expect(
      parseSettlementRange({
        endDate: '2026-05-08',
        gameId: ' game-1 ',
        startDate: '2026-05-08',
        userId: ' user-1 ',
      }),
    ).toMatchObject({
      gameId: 'game-1',
      userId: 'user-1',
    });
  });

  it('rejects whitespace-only ids', () => {
    expect(() =>
      parseSettlementRange({
        endDate: '2026-05-08',
        gameId: '   ',
        startDate: '2026-05-08',
      }),
    ).toThrow(BadRequestException);
    expect(() =>
      parseSettlementRange({
        endDate: '2026-05-08',
        gameId: 'game-1',
        startDate: '2026-05-08',
        userId: '   ',
      }),
    ).toThrow(BadRequestException);
  });

  it('rejects invalid calendar dates', () => {
    expect(() =>
      parseSettlementRange({
        endDate: '2026-02-31',
        gameId: 'game-1',
        startDate: '2026-02-31',
      }),
    ).toThrow(BadRequestException);
  });

  it('rejects invalid ranges', () => {
    expect(() =>
      parseSettlementRange({
        endDate: '2026-05-07',
        gameId: 'game-1',
        startDate: '2026-05-08',
      }),
    ).toThrow(BadRequestException);
  });

  it('wraps invalid input shape as a bad request', () => {
    expect(() =>
      parseSettlementRange({
        endDate: '2026-05-08',
        startDate: '2026-05-08',
      }),
    ).toThrow(BadRequestException);
  });
});

describe('SettlementAdminController', () => {
  it('presents preview money and counts', async () => {
    const service = createService();
    const controller = new SettlementAdminController(service);

    await expect(
      controller.preview({
        endDate: '2026-05-08',
        gameId: ' game-1 ',
        startDate: '2026-05-08',
        userId: ' user-1 ',
      }),
    ).resolves.toMatchObject({
      budgetAfter: {
        li: '7000',
        yuan: '7.00',
      },
      canConfirm: true,
      settlementAmount: {
        li: '3000',
        yuan: '3.00',
      },
      settlementCount: 2,
      userCount: 2,
    });
    expect(service.lastPreviewInput).toEqual({
      endedAt: new Date('2026-05-08T23:59:59.999Z'),
      gameId: 'game-1',
      startedAt: new Date('2026-05-08T00:00:00.000Z'),
      userId: 'user-1',
    });
  });

  it('passes current admin into confirmation', async () => {
    const service = createService();
    const controller = new SettlementAdminController(service);

    const result = await controller.confirm(
      {
        role: 'SUPER_ADMIN',
        username: 'admin',
      },
      {
        endDate: '2026-05-08',
        gameId: ' game-1 ',
        startDate: '2026-05-08',
        userId: ' user-1 ',
      },
    );

    expect(result.batch.operatorId).toBe('admin');
    expect(result.batch.operatorType).toBe('SUPER_ADMIN');
    expect(result.batch).not.toHaveProperty('items');
    expect(result.items).toEqual([
      expect.objectContaining({
        id: 'item-1',
      }),
    ]);
    expect(service.lastConfirmInput).toEqual({
      endedAt: new Date('2026-05-08T23:59:59.999Z'),
      gameId: 'game-1',
      operatorId: 'admin',
      operatorType: 'SUPER_ADMIN',
      startedAt: new Date('2026-05-08T00:00:00.000Z'),
      userId: 'user-1',
    });
  });

  it('rejects company admins before confirming settlements', async () => {
    const service = createService();
    const controller = new SettlementAdminController(service);

    await expect(
      controller.confirm(
        {
          adminId: 'company-admin-1',
          displayName: 'Company Admin',
          role: 'COMPANY_ADMIN',
          username: 'company_admin',
        },
        {
          endDate: '2026-05-08',
          gameId: 'game-1',
          startDate: '2026-05-08',
        },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(service.confirmSettlement).not.toHaveBeenCalled();
  });

  it('presents batch lists with money and ISO dates', async () => {
    const service = createService();
    const controller = new SettlementAdminController(service);
    const result = await controller.list(admin, {
      gameId: ' game-1 ',
    });

    expect(result).toEqual({
      batches: [
        expect.objectContaining({
          budgetBefore: {
            li: '10000',
            yuan: '10.00',
          },
          createdAt: '2026-05-08T04:00:00.000Z',
          id: 'batch-1',
          settledAmount: {
            li: '3000',
            yuan: '3.00',
          },
        }),
      ],
    });
    expect(result.batches[0]).not.toHaveProperty('items');
    expect(service.lastListInput).toEqual({
      admin,
      gameId: 'game-1',
    });
  });

  it('rejects invalid batch list query shapes', async () => {
    const controller = new SettlementAdminController(createService());

    await expect(
      controller.list(admin, {
        gameId: ['game-1', 'game-2'],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      controller.list(admin, {
        gameId: '   ',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('presents batch details with item money and ISO dates', async () => {
    const service = createService();
    const controller = new SettlementAdminController(service);
    const result = await controller.detail(admin, 'batch-1');

    expect(result).toEqual({
      batch: expect.objectContaining({
        endedAt: '2026-05-08T23:59:59.999Z',
        id: 'batch-1',
        startedAt: '2026-05-08T00:00:00.000Z',
      }),
      items: [
        expect.objectContaining({
          createdAt: '2026-05-08T04:00:00.000Z',
          displayAmount: {
            li: '1000',
            yuan: '1.00',
          },
          directAgentAmount: {
            li: '100',
            yuan: '0.10',
          },
          feeAmount: {
            li: '50',
            yuan: '0.05',
          },
          id: 'item-1',
          settlementAmount: {
            li: '1000',
            yuan: '1.00',
          },
          userAmount: {
            li: '700',
            yuan: '0.70',
          },
        }),
      ],
    });
    expect(result.batch).not.toHaveProperty('items');
    expect(service.lastGetBatchInput).toEqual({
      admin,
      batchId: 'batch-1',
    });
  });
});

const admin = {
  role: 'SUPER_ADMIN' as const,
  username: 'admin',
};

function createService() {
  const service = {
    confirmSettlement: jest.fn(async (input: any) => {
      service.lastConfirmInput = input;
      const batch = createBatch({
        endedAt: input.endedAt,
        operatorId: input.operatorId,
        operatorType: input.operatorType,
        startedAt: input.startedAt,
      });
      return {
        batch,
        items: batch.items,
      };
    }),
    getBatch: async (input: any) => {
      service.lastGetBatchInput = input;
      return createBatch();
    },
    lastConfirmInput: undefined as any,
    lastGetBatchInput: undefined as any,
    lastListInput: undefined as any,
    lastPreviewInput: undefined as any,
    listBatches: async (input: { admin: unknown; gameId?: string }) => {
      service.lastListInput = input;
      return [createBatch()];
    },
    previewSettlement: async (input: any) => {
      service.lastPreviewInput = input;
      return {
        budgetAfterLi: 7000n,
        budgetBeforeLi: 10000n,
        canConfirm: true,
        companyId: 'company-1',
        gameId: 'game-1',
        settlementAmountLi: 3000n,
        settlementCount: 2,
        unboundCount: 1,
        userCount: 2,
      };
    },
  };

  return service as any;
}

function createBatch(
  overrides: Partial<{
    endedAt: Date;
    operatorId: string;
    operatorType: string;
    startedAt: Date;
  }> = {},
) {
  return {
    budgetAfterLi: 7000n,
    budgetBeforeLi: 10000n,
    companyId: 'company-1',
    configSnapshot: {
      source: 'test',
    },
    createdAt: new Date('2026-05-08T04:00:00.000Z'),
    endedAt: overrides.endedAt ?? new Date('2026-05-08T23:59:59.999Z'),
    gameId: 'game-1',
    id: 'batch-1',
    items: [
      {
        batchId: 'batch-1',
        createdAt: new Date('2026-05-08T04:00:00.000Z'),
        displayAmountLi: 1000n,
        defaultAgentAmountLi: 50n,
        defaultAgentId: 'agent-default-1',
        directAgentAmountLi: 100n,
        directAgentId: 'agent-direct-1',
        feeAmountLi: 50n,
        gameOpenIdId: 'open-row-1',
        id: 'item-1',
        openId: 'open-1',
        parentAgentAmountLi: 100n,
        parentAgentId: 'agent-parent-1',
        rawEcpmId: 'ecpm-1',
        settlementAmountLi: 1000n,
        splitSnapshot: {
          source: 'test',
        },
        userAmountLi: 700n,
        userId: 'user-1',
      },
    ],
    operatorId: overrides.operatorId ?? 'admin',
    operatorType: overrides.operatorType ?? 'SUPER_ADMIN',
    settledAmountLi: 3000n,
    settledCount: 2,
    startedAt: overrides.startedAt ?? new Date('2026-05-08T00:00:00.000Z'),
    status: 'CONFIRMED',
    userCount: 2,
  };
}
