import { BadRequestException } from '@nestjs/common';
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
    const controller = new SettlementAdminController(createService());

    await expect(
      controller.preview({
        endDate: '2026-05-08',
        gameId: 'game-1',
        startDate: '2026-05-08',
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
        gameId: 'game-1',
        startDate: '2026-05-08',
      },
    );

    expect(result.batch.operatorId).toBe('admin');
    expect(result.batch.operatorType).toBe('SUPER_ADMIN');
    expect(service.lastOperatorId).toBe('admin');
    expect(service.lastOperatorType).toBe('SUPER_ADMIN');
  });

  it('presents batch lists with money and ISO dates', async () => {
    const controller = new SettlementAdminController(createService());

    await expect(controller.list(' game-1 ')).resolves.toEqual({
      batches: [
        expect.objectContaining({
          budgetBefore: {
            li: '10000',
            yuan: '10.00',
          },
          createdAt: '2026-05-08T04:00:00.000Z',
          id: 'batch-1',
          items: [
            expect.objectContaining({
              settlementAmount: {
                li: '1000',
                yuan: '1.00',
              },
            }),
          ],
          settledAmount: {
            li: '3000',
            yuan: '3.00',
          },
        }),
      ],
    });
  });

  it('presents batch details with item money and ISO dates', async () => {
    const controller = new SettlementAdminController(createService());

    await expect(controller.detail('batch-1')).resolves.toEqual({
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
          id: 'item-1',
          settlementAmount: {
            li: '1000',
            yuan: '1.00',
          },
        }),
      ],
    });
  });
});

function createService() {
  const service = {
    lastOperatorId: '',
    lastOperatorType: '',
    confirmSettlement: async (input: any) => {
      const batch = createBatch({
        endedAt: input.endedAt,
        operatorId: input.operatorId,
        operatorType: input.operatorType,
        startedAt: input.startedAt,
      });
      service.lastOperatorId = input.operatorId;
      service.lastOperatorType = input.operatorType;
      return {
        batch,
        items: batch.items,
      };
    },
    getBatch: async () => createBatch(),
    listBatches: async (input: { gameId?: string }) => {
      service.lastGameId = input.gameId ?? '';
      return [createBatch()];
    },
    lastGameId: '',
    previewSettlement: async () => ({
      budgetAfterLi: 7000n,
      budgetBeforeLi: 10000n,
      canConfirm: true,
      companyId: 'company-1',
      gameId: 'game-1',
      settlementAmountLi: 3000n,
      settlementCount: 2,
      unboundCount: 1,
      userCount: 2,
    }),
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
        gameOpenIdId: 'open-row-1',
        id: 'item-1',
        openId: 'open-1',
        rawEcpmId: 'ecpm-1',
        settlementAmountLi: 1000n,
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
