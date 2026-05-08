import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import {
  BudgetExceededException,
  SettlementAdminService,
  type SettlementAdminPrisma,
} from './settlement-admin.service';

describe('SettlementAdminService', () => {
  const range = {
    endedAt: new Date('2026-05-08T23:59:59.999Z'),
    startedAt: new Date('2026-05-08T00:00:00.000Z'),
  };

  it('previews bound pending ECPM against game budget while counting unbound rows', async () => {
    const prisma = createFakePrisma();
    const service = new SettlementAdminService(prisma);

    const result = await service.previewSettlement({
      gameId: 'game-1',
      ...range,
    });

    expect(result).toMatchObject({
      budgetAfterLi: 7000n,
      budgetBeforeLi: 10000n,
      canConfirm: true,
      gameId: 'game-1',
      settlementAmountLi: 3000n,
      settlementCount: 2,
      unboundCount: 2,
      userCount: 2,
    });
  });

  it('confirms settlement by creating a batch, crediting users, and deducting budget', async () => {
    const prisma = createFakePrisma();
    const service = new SettlementAdminService(prisma);

    const result = await service.confirmSettlement({
      gameId: 'game-1',
      operatorId: 'admin',
      operatorType: 'SUPER_ADMIN',
      ...range,
    });

    expect(result.batch.status).toBe('CONFIRMED');
    expect(result.batch.settledAmountLi).toBe(3000n);
    expect(result.items).toHaveLength(2);
    expect(prisma.getGame('game-1')?.budgetLi).toBe(7000n);
    expect(prisma.getGame('game-1')?.settlementPaused).toBe(false);
    expect(prisma.getUser('user-1')?.availableBalanceLi).toBe(1000n);
    expect(prisma.getUser('user-2')?.availableBalanceLi).toBe(2000n);
    expect(prisma.getRawEcpm('ecpm-1')?.status).toBe('SETTLED');
    expect(prisma.getRawEcpm('ecpm-2')?.status).toBe('SETTLED');
    expect(prisma.getRawEcpm('ecpm-unbound')?.status).toBe('PENDING');
    expect(prisma.getAuditActions()).toContain('settlement.confirmed');
  });

  it('marks the game paused and rejects confirmation when budget is insufficient', async () => {
    const prisma = createFakePrisma({
      gameBudgetLi: 2500n,
      initialSettlementPaused: false,
    });
    const service = new SettlementAdminService(prisma);

    await expect(
      service.confirmSettlement({
        gameId: 'game-1',
        operatorId: 'admin',
        operatorType: 'SUPER_ADMIN',
        ...range,
      }),
    ).rejects.toBeInstanceOf(BudgetExceededException);

    expect(prisma.getGame('game-1')?.budgetLi).toBe(2500n);
    expect(prisma.getGame('game-1')?.settlementPaused).toBe(true);
    expect(prisma.getUser('user-1')?.availableBalanceLi).toBe(0n);
    expect(prisma.getRawEcpm('ecpm-1')?.status).toBe('PENDING');
    expect(prisma.getAuditActions()).toContain(
      'settlement.budget_insufficient',
    );
  });

  it('marks the game paused and rejects when budget becomes insufficient during confirmation', async () => {
    const prisma = createFakePrisma({
      initialSettlementPaused: false,
      transactionGameBudgetLi: 2500n,
    });
    const service = new SettlementAdminService(prisma);

    await expect(
      service.confirmSettlement({
        gameId: 'game-1',
        operatorId: 'admin',
        operatorType: 'SUPER_ADMIN',
        ...range,
      }),
    ).rejects.toBeInstanceOf(BudgetExceededException);

    expect(prisma.getGame('game-1')?.budgetLi).toBe(2500n);
    expect(prisma.getGame('game-1')?.settlementPaused).toBe(true);
    expect(prisma.getUser('user-1')?.availableBalanceLi).toBe(0n);
    expect(prisma.getUser('user-2')?.availableBalanceLi).toBe(0n);
    expect(prisma.getRawEcpm('ecpm-1')?.status).toBe('PENDING');
    expect(prisma.getRawEcpm('ecpm-2')?.status).toBe('PENDING');
    expect(prisma.getAuditActions()).toContain(
      'settlement.budget_insufficient',
    );
  });

  it('rolls back settlement and persists pause when protected budget update fails', async () => {
    const prisma = createFakePrisma({
      initialSettlementPaused: false,
      protectedBudgetUpdateFails: true,
    });
    const service = new SettlementAdminService(prisma);

    await expect(
      service.confirmSettlement({
        gameId: 'game-1',
        operatorId: 'admin',
        operatorType: 'SUPER_ADMIN',
        ...range,
      }),
    ).rejects.toBeInstanceOf(BudgetExceededException);

    expect(prisma.getGame('game-1')?.settlementPaused).toBe(true);
    expect(prisma.getUser('user-1')?.availableBalanceLi).toBe(0n);
    expect(prisma.getUser('user-2')?.availableBalanceLi).toBe(0n);
    expect(prisma.getRawEcpm('ecpm-1')?.status).toBe('PENDING');
    expect(prisma.getRawEcpm('ecpm-2')?.status).toBe('PENDING');
    expect(prisma.getBatchCount()).toBe(0);
    expect(prisma.getAuditActions()).toContain(
      'settlement.budget_insufficient',
    );
  });

  it('treats stale binding before raw row write as a settlement conflict', async () => {
    const prisma = createFakePrisma({
      changeBindingBeforeRawUpdate: {
        rawEcpmId: 'ecpm-1',
        userId: 'user-2',
      },
    });
    const service = new SettlementAdminService(prisma);

    await expect(
      service.confirmSettlement({
        gameId: 'game-1',
        operatorId: 'admin',
        operatorType: 'SUPER_ADMIN',
        ...range,
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(prisma.getUser('user-1')?.availableBalanceLi).toBe(0n);
    expect(prisma.getUser('user-2')?.availableBalanceLi).toBe(0n);
    expect(prisma.getRawEcpm('ecpm-1')?.status).toBe('PENDING');
    expect(prisma.getRawEcpm('ecpm-2')?.status).toBe('PENDING');
    expect(prisma.getBatchCount()).toBe(0);
    expect(prisma.getAuditActions()).toContain('settlement.conflict');
  });

  it('rejects binding changes committed before open-id locks are acquired', async () => {
    const prisma = createFakePrisma({
      changeBindingBeforeOpenIdLock: {
        openIdRecordId: 'open-row-1',
        userId: 'user-2',
      },
    });
    const service = new SettlementAdminService(prisma);

    await expect(
      service.confirmSettlement({
        gameId: 'game-1',
        operatorId: 'admin',
        operatorType: 'SUPER_ADMIN',
        ...range,
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(prisma.getBatchCount()).toBe(0);
    expect(prisma.getUser('user-1')?.availableBalanceLi).toBe(0n);
    expect(prisma.getUser('user-2')?.availableBalanceLi).toBe(0n);
    expect(prisma.getRawEcpm('ecpm-1')?.status).toBe('PENDING');
    expect(prisma.getRawEcpm('ecpm-2')?.status).toBe('PENDING');
    expect(prisma.getAuditActions()).toContain('settlement.conflict');
  });

  it('locks open-id rows before raw updates and credits', async () => {
    const prisma = createFakePrisma({
      changeBindingAfterOpenIdLock: {
        openIdRecordId: 'open-row-1',
        userId: 'user-2',
      },
    });
    const service = new SettlementAdminService(prisma);

    const result = await service.confirmSettlement({
      gameId: 'game-1',
      operatorId: 'admin',
      operatorType: 'SUPER_ADMIN',
      ...range,
    });

    expect(result.batch.status).toBe('CONFIRMED');
    expect(prisma.getUser('user-1')?.availableBalanceLi).toBe(1000n);
    expect(prisma.getUser('user-2')?.availableBalanceLi).toBe(2000n);
    expect(prisma.getOpenId('open-row-1')?.userId).toBe('user-1');
    expect(prisma.getEventNames()).toEqual(
      expect.arrayContaining([
        'lock:game',
        'lock:openIds',
        'rawEcpm.updateMany',
        'userAccount.update',
      ]),
    );
    expect(prisma.getEventNames().indexOf('lock:openIds')).toBeLessThan(
      prisma.getEventNames().indexOf('rawEcpm.updateMany'),
    );
    expect(prisma.getEventNames().indexOf('lock:openIds')).toBeLessThan(
      prisma.getEventNames().indexOf('userAccount.update'),
    );
  });

  it('uses locked game budget state for settlement batch fields', async () => {
    const prisma = createFakePrisma({
      gameBudgetLi: 10000n,
      gameBudgetBeforeLockLi: 5000n,
    });
    const service = new SettlementAdminService(prisma);

    const result = await service.confirmSettlement({
      gameId: 'game-1',
      operatorId: 'admin',
      operatorType: 'SUPER_ADMIN',
      ...range,
    });

    expect(result.batch.budgetBeforeLi).toBe(5000n);
    expect(result.batch.budgetAfterLi).toBe(2000n);
    expect(prisma.getGame('game-1')?.budgetLi).toBe(2000n);
  });

  it('rejects confirmation when no bound pending ECPM exists', async () => {
    const prisma = createFakePrisma({
      includeBoundRows: false,
    });
    const service = new SettlementAdminService(prisma);

    await expect(
      service.confirmSettlement({
        gameId: 'game-1',
        operatorId: 'admin',
        operatorType: 'SUPER_ADMIN',
        ...range,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects missing games', async () => {
    const prisma = createFakePrisma();
    const service = new SettlementAdminService(prisma);

    await expect(
      service.previewSettlement({
        gameId: 'missing',
        ...range,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects invalid date ranges', async () => {
    const prisma = createFakePrisma();
    const service = new SettlementAdminService(prisma);

    await expect(
      service.previewSettlement({
        endedAt: range.startedAt,
        gameId: 'game-1',
        startedAt: range.endedAt,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects concurrent settlement changes', async () => {
    const prisma = createFakePrisma({
      updateManyCountOverride: 1,
    });
    const service = new SettlementAdminService(prisma);

    await expect(
      service.confirmSettlement({
        gameId: 'game-1',
        operatorId: 'admin',
        operatorType: 'SUPER_ADMIN',
        ...range,
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(prisma.getGame('game-1')?.budgetLi).toBe(10000n);
    expect(prisma.getAuditActions()).toContain('settlement.conflict');
  });

  it('lists and gets settlement batches with items', async () => {
    const prisma = createFakePrisma();
    const service = new SettlementAdminService(prisma);

    const confirmed = await service.confirmSettlement({
      gameId: 'game-1',
      operatorId: 'admin',
      operatorType: 'SUPER_ADMIN',
      ...range,
    });

    await expect(service.listBatches({ gameId: 'game-1' })).resolves.toEqual([
      confirmed.batch,
    ]);
    await expect(service.getBatch('batch-1')).resolves.toEqual(
      confirmed.batch,
    );
    await expect(service.getBatch('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

type FakeGame = {
  id: string;
  budgetLi: bigint;
  companyId: string;
  settlementPaused: boolean;
};

type FakeOpenId = {
  id: string;
  openId: string;
  userId: string | null;
};

type FakeRawEcpm = {
  id: string;
  displayAmountLi: bigint;
  eventTime: Date;
  gameId: string;
  openId: string;
  openIdRecord: FakeOpenId | null;
  openIdRecordId: string | null;
  status: string;
};

type FakeUser = {
  id: string;
  availableBalanceLi: bigint;
};

function createFakePrisma(
  options: {
    gameBudgetLi?: bigint;
    includeBoundRows?: boolean;
    updateManyCountOverride?: number;
    initialSettlementPaused?: boolean;
    transactionGameBudgetLi?: bigint;
    protectedBudgetUpdateFails?: boolean;
    gameBudgetBeforeLockLi?: bigint;
    changeBindingBeforeRawUpdate?: {
      rawEcpmId: string;
      userId: string | null;
    };
    changeBindingBeforeOpenIdLock?: {
      openIdRecordId: string;
      userId: string | null;
    };
    changeBindingAfterOpenIdLock?: {
      openIdRecordId: string;
      userId: string | null;
    };
  } = {},
) {
  const games = new Map<string, FakeGame>([
    [
      'game-1',
      {
        budgetLi: options.gameBudgetLi ?? 10000n,
        companyId: 'company-1',
        id: 'game-1',
        settlementPaused: options.initialSettlementPaused ?? true,
      },
    ],
  ]);

  const openIds = new Map<string, FakeOpenId>([
    ['open-row-1', { id: 'open-row-1', openId: 'open-1', userId: 'user-1' }],
    ['open-row-2', { id: 'open-row-2', openId: 'open-2', userId: 'user-2' }],
    ['open-row-3', { id: 'open-row-3', openId: 'open-3', userId: null }],
  ]);

  const users = new Map<string, FakeUser>([
    ['user-1', { availableBalanceLi: 0n, id: 'user-1' }],
    ['user-2', { availableBalanceLi: 0n, id: 'user-2' }],
  ]);

  const rawEcpms = new Map<string, FakeRawEcpm>();
  if (options.includeBoundRows !== false) {
    rawEcpms.set('ecpm-1', {
      displayAmountLi: 1000n,
      eventTime: new Date('2026-05-08T01:00:00.000Z'),
      gameId: 'game-1',
      id: 'ecpm-1',
      openId: 'open-1',
      openIdRecord: openIds.get('open-row-1') ?? null,
      openIdRecordId: 'open-row-1',
      status: 'PENDING',
    });
    rawEcpms.set('ecpm-2', {
      displayAmountLi: 2000n,
      eventTime: new Date('2026-05-08T02:00:00.000Z'),
      gameId: 'game-1',
      id: 'ecpm-2',
      openId: 'open-2',
      openIdRecord: openIds.get('open-row-2') ?? null,
      openIdRecordId: 'open-row-2',
      status: 'PENDING',
    });
  }
  rawEcpms.set('ecpm-unbound', {
    displayAmountLi: 9000n,
    eventTime: new Date('2026-05-08T03:00:00.000Z'),
    gameId: 'game-1',
    id: 'ecpm-unbound',
    openId: 'open-3',
    openIdRecord: openIds.get('open-row-3') ?? null,
    openIdRecordId: 'open-row-3',
    status: 'PENDING',
  });
  rawEcpms.set('ecpm-no-open-id-record', {
    displayAmountLi: 8000n,
    eventTime: new Date('2026-05-08T03:30:00.000Z'),
    gameId: 'game-1',
    id: 'ecpm-no-open-id-record',
    openId: 'open-no-record',
    openIdRecord: null,
    openIdRecordId: null,
    status: 'PENDING',
  });

  const batches: any[] = [];
  const auditLogs: any[] = [];
  const events: string[] = [];
  const lockedOpenIdIds = new Set<string>();
  let gameLockApplied = false;
  let openIdLockApplied = false;
  let rawUpdateManyRemaining = options.updateManyCountOverride;

  const matchesWhere = (row: FakeRawEcpm, where: any): boolean => {
    if (where.OR) {
      return where.OR.some((branch: any) =>
        matchesWhere(row, {
          ...where,
          OR: undefined,
          ...branch,
        }),
      );
    }

    if (row.gameId !== where.gameId) return false;
    if (row.status !== where.status) return false;
    if (row.eventTime < where.eventTime.gte) return false;
    if (row.eventTime > where.eventTime.lte) return false;
    if (where.openIdRecordId === null && row.openIdRecordId !== null) {
      return false;
    }
    const relationFilter = where.openIdRecord?.is;
    if (relationFilter?.userId?.not === null) {
      return row.openIdRecord !== null && row.openIdRecord.userId !== null;
    }
    if (relationFilter?.userId === null) {
      return row.openIdRecord !== null && row.openIdRecord.userId === null;
    }
    if (relationFilter?.userId) {
      return (
        row.openIdRecord !== null &&
        row.openIdRecord.userId === relationFilter.userId
      );
    }
    return true;
  };

  const findPendingRows = (where: any) =>
    Array.from(rawEcpms.values()).filter((row) => matchesWhere(row, where));

  const cloneGames = () =>
    new Map(
      Array.from(games.entries()).map(([key, value]) => [key, { ...value }]),
    );
  const cloneRawEcpms = () =>
    new Map(
      Array.from(rawEcpms.entries()).map(([key, value]) => [
        key,
        { ...value },
      ]),
    );
  const cloneUsers = () =>
    new Map(
      Array.from(users.entries()).map(([key, value]) => [key, { ...value }]),
    );
  const restoreMap = <T>(target: Map<string, T>, snapshot: Map<string, T>) => {
    target.clear();
    for (const [key, value] of snapshot) {
      target.set(key, value);
    }
  };

  const prisma: SettlementAdminPrisma & {
    getAuditActions(): string[];
    getBatchCount(): number;
    getEventNames(): string[];
    getGame(id: string): FakeGame | undefined;
    getOpenId(id: string): FakeOpenId | undefined;
    getRawEcpm(id: string): FakeRawEcpm | undefined;
    getUser(id: string): FakeUser | undefined;
  } = {
    $queryRaw: (async (query: any) => {
      const queryText = String(query?.strings?.join('') ?? query);
      if (queryText.includes('FROM games')) {
        events.push('lock:game');
        if (
          !gameLockApplied &&
          options.gameBudgetBeforeLockLi !== undefined
        ) {
          const game = games.get('game-1');
          if (game) {
            games.set('game-1', {
              ...game,
              budgetLi: options.gameBudgetBeforeLockLi,
            });
          }
          gameLockApplied = true;
        }
        const game = games.get('game-1');
        return game
          ? [
              {
                budgetLi: game.budgetLi,
                companyId: game.companyId,
                id: game.id,
              },
            ]
          : [];
      }
      if (queryText.includes('FROM game_open_ids')) {
        events.push('lock:openIds');
        if (
          !openIdLockApplied &&
          options.changeBindingBeforeOpenIdLock !== undefined
        ) {
          const openId = openIds.get(
            options.changeBindingBeforeOpenIdLock.openIdRecordId,
          );
          if (openId) {
            openIds.set(openId.id, {
              ...openId,
              userId: options.changeBindingBeforeOpenIdLock.userId,
            });
          }
        }
        openIdLockApplied = true;
        for (const rawEcpm of rawEcpms.values()) {
          if (rawEcpm.openIdRecordId) {
            lockedOpenIdIds.add(rawEcpm.openIdRecordId);
          }
        }
        if (options.changeBindingAfterOpenIdLock !== undefined) {
          const change = options.changeBindingAfterOpenIdLock;
          if (!lockedOpenIdIds.has(change.openIdRecordId)) {
            const openId = openIds.get(change.openIdRecordId);
            if (openId) {
              openIds.set(openId.id, {
                ...openId,
                userId: change.userId,
              });
            }
          }
          options.changeBindingAfterOpenIdLock = undefined;
        }
        return Array.from(lockedOpenIdIds)
          .map((id) => openIds.get(id))
          .filter(Boolean)
          .map((openId) => ({
            id: openId?.id,
            userId: openId?.userId,
          }));
      }
      return [];
    }) as any,
    $transaction: async (callback: any) => {
      if (options.transactionGameBudgetLi !== undefined) {
        const game = games.get('game-1');
        if (game) {
          games.set('game-1', {
            ...game,
            budgetLi: options.transactionGameBudgetLi,
          });
        }
      }
      const gameSnapshot = cloneGames();
      const rawEcpmSnapshot = cloneRawEcpms();
      const userSnapshot = cloneUsers();
      const batchSnapshot = [...batches];
      const auditLogSnapshot = [...auditLogs];

      try {
        return await callback(prisma);
      } catch (error) {
        restoreMap(games, gameSnapshot);
        restoreMap(rawEcpms, rawEcpmSnapshot);
        restoreMap(users, userSnapshot);
        batches.length = 0;
        batches.push(...batchSnapshot);
        auditLogs.length = 0;
        auditLogs.push(...auditLogSnapshot);
        throw error;
      }
    },
    auditLog: {
      create: async ({ data }: any) => {
        auditLogs.push(data);
        return data;
      },
    } as any,
    game: {
      findUnique: async ({ where }: any) => games.get(where.id) ?? null,
      update: async ({ data, where }: any) => {
        const game = games.get(where.id);
        if (!game) throw new Error('game not found');
        const next = {
          ...game,
          budgetLi:
            data.budgetLi?.decrement === undefined
              ? game.budgetLi
              : game.budgetLi - data.budgetLi.decrement,
          settlementPaused: data.settlementPaused ?? game.settlementPaused,
        };
        games.set(where.id, next);
        return next;
      },
      updateMany: async ({ data, where }: any) => {
        const game = games.get(where.id);
        if (!game) {
          return {
            count: 0,
          };
        }
        if (
          options.protectedBudgetUpdateFails ||
          game.budgetLi < where.budgetLi.gte
        ) {
          return {
            count: 0,
          };
        }
        const next = {
          ...game,
          budgetLi:
            data.budgetLi?.decrement === undefined
              ? game.budgetLi
              : game.budgetLi - data.budgetLi.decrement,
          settlementPaused: data.settlementPaused ?? game.settlementPaused,
        };
        games.set(where.id, next);
        return {
          count: 1,
        };
      },
    } as any,
    rawEcpm: {
      findMany: async ({ where }: any) => findPendingRows(where),
      updateMany: async ({ data, where }: any) => {
        events.push('rawEcpm.updateMany');
        if (options.changeBindingBeforeRawUpdate) {
          const row = rawEcpms.get(
            options.changeBindingBeforeRawUpdate.rawEcpmId,
          );
          if (row) {
            row.openIdRecord =
              row.openIdRecord === null
                ? null
                : {
                    ...row.openIdRecord,
                    userId: options.changeBindingBeforeRawUpdate.userId,
                  };
          }
          options.changeBindingBeforeRawUpdate = undefined;
        }
        const rows = Array.from(rawEcpms.values()).filter((row) => {
          const idMatches = where.id.in
            ? where.id.in.includes(row.id)
            : row.id === where.id;
          if (!idMatches || row.status !== where.status) {
            return false;
          }
          if (
            where.openIdRecordId !== undefined &&
            row.openIdRecordId !== where.openIdRecordId
          ) {
            return false;
          }
          const relationFilter = where.openIdRecord?.is;
          if (
            relationFilter?.userId !== undefined &&
            row.openIdRecord?.userId !== relationFilter.userId
          ) {
            return false;
          }
          return true;
        });
        const rowsToUpdate =
          rawUpdateManyRemaining === undefined
            ? rows
            : rows.slice(0, rawUpdateManyRemaining);
        for (const row of rowsToUpdate) {
          row.status = data.status;
        }
        if (rawUpdateManyRemaining !== undefined) {
          rawUpdateManyRemaining = Math.max(
            rawUpdateManyRemaining - rowsToUpdate.length,
            0,
          );
        }
        return {
          count: rowsToUpdate.length,
        };
      },
    } as any,
    settlementBatch: {
      create: async ({ data }: any) => {
        const batch = {
          ...data,
          createdAt: new Date('2026-05-08T04:00:00.000Z'),
          id: 'batch-1',
          items: data.items.create.map((item: any, index: number) => ({
            ...item,
            batchId: 'batch-1',
            createdAt: new Date('2026-05-08T04:00:00.000Z'),
            id: `item-${index + 1}`,
          })),
        };
        batches.unshift(batch);
        return batch;
      },
      findMany: async ({ where }: any = {}) =>
        where?.gameId
          ? batches.filter((batch) => batch.gameId === where.gameId)
          : batches,
      findUnique: async ({ where }: any) =>
        batches.find((batch) => batch.id === where.id) ?? null,
    } as any,
    userAccount: {
      update: async ({ data, where }: any) => {
        events.push('userAccount.update');
        const user = users.get(where.id);
        if (!user) throw new Error('user not found');
        user.availableBalanceLi += data.availableBalanceLi.increment;
        return user;
      },
    } as any,
    getAuditActions: () => auditLogs.map((row) => row.action),
    getBatchCount: () => batches.length,
    getEventNames: () => events,
    getGame: (id: string) => games.get(id),
    getOpenId: (id: string) => openIds.get(id),
    getRawEcpm: (id: string) => rawEcpms.get(id),
    getUser: (id: string) => users.get(id),
  };

  return prisma;
}
