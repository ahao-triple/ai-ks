import { BadRequestException } from '@nestjs/common';
import { EcpmDashboardService } from './ecpm-dashboard.service';
import type { AdminPrincipal } from '../admin-auth/admin-auth.service';
import type { AdminReadScope } from '../admin-auth/admin-access-control.service';

describe('EcpmDashboardService', () => {
  it('summarizes latest ECPM by company and game for super admins', async () => {
    const latestHour = new Date('2026-05-08T06:00:00.000Z');
    const prisma = createFakePrisma();
    prisma.rawEcpm.findMany.mockResolvedValueOnce([{ eventTime: latestHour }]);
    prisma.rawEcpm.groupBy.mockResolvedValueOnce([
      {
        _count: {
          _all: 1,
        },
        _max: {
          createdAt: new Date('2026-05-08T14:20:00.000Z'),
        },
        _sum: {
          displayAmountLi: 20n,
          rawCostLi: 40n,
        },
        eventTime: latestHour,
        gameId: 'game-1',
        openId: 'open-a',
      },
      {
        _count: {
          _all: 1,
        },
        _max: {
          createdAt: new Date('2026-05-08T14:30:00.000Z'),
        },
        _sum: {
          displayAmountLi: 30n,
          rawCostLi: 60n,
        },
        eventTime: latestHour,
        gameId: 'game-1',
        openId: 'open-b',
      },
    ]);
    prisma.game.findMany.mockResolvedValueOnce([gameRecord()]);
    const service = createService(prisma);

    const result = await service.queryCompany({
      admin: superAdmin,
    });

    expect(prisma.rawEcpm.findMany).toHaveBeenCalledWith({
      orderBy: {
        eventTime: 'desc',
      },
      select: {
        eventTime: true,
      },
      take: 1,
      where: {
        game: {
          deletedAt: null,
        },
      },
    });
    expect(prisma.rawEcpm.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          eventTime: {
            gte: latestHour,
            lt: new Date('2026-05-08T07:00:00.000Z'),
          },
        }),
      }),
    );
    expect(
      prisma.rawEcpm.findMany.mock.invocationCallOrder[0],
    ).toBeLessThan(prisma.rawEcpm.groupBy.mock.invocationCallOrder[0]);
    expect(result).toEqual({
      rows: [
        {
          companyId: 'company-1',
          companyName: 'Company A',
          dataHour: '2026-05-08T14:00:00+08:00',
          displayAmount: { li: '50', yuan: '0.05' },
          eventCount: 2,
          gameAppId: 'game-app-1',
          gameId: 'game-1',
          gameName: 'Game A',
          openIdCount: 2,
          rawCost: { li: '100', yuan: '0.10' },
          updatedAt: '2026-05-08T14:30:00.000Z',
        },
      ],
      scope: 'company',
    });
  });

  it('returns latest dashboard scope for latest ECPM summaries', async () => {
    const latestHour = new Date('2026-05-08T06:00:00.000Z');
    const prisma = createFakePrisma();
    prisma.rawEcpm.findMany.mockResolvedValueOnce([{ eventTime: latestHour }]);
    prisma.rawEcpm.groupBy.mockResolvedValueOnce([
      {
        _count: {
          _all: 1,
        },
        _max: {
          createdAt: new Date('2026-05-08T14:30:00.000Z'),
        },
        _sum: {
          displayAmountLi: 50n,
          rawCostLi: 100n,
        },
        eventTime: latestHour,
        gameId: 'game-1',
        openId: 'open-a',
      },
    ]);
    prisma.game.findMany.mockResolvedValueOnce([gameRecord()]);
    const service = createService(prisma);

    const result = await service.queryLatest({
      admin: superAdmin,
    });

    expect(result).toMatchObject({
      rows: [
        expect.objectContaining({
          dataHour: '2026-05-08T14:00:00+08:00',
          gameId: 'game-1',
        }),
      ],
      scope: 'latest',
    });
  });

  it('ignores supplied hour filters when querying latest ECPM summaries', async () => {
    const latestHour = new Date('2026-05-08T06:00:00.000Z');
    const prisma = createFakePrisma();
    prisma.rawEcpm.findMany.mockResolvedValueOnce([{ eventTime: latestHour }]);
    prisma.rawEcpm.groupBy.mockResolvedValueOnce([
      {
        _count: {
          _all: 1,
        },
        _max: {
          createdAt: new Date('2026-05-08T14:30:00.000Z'),
        },
        _sum: {
          displayAmountLi: 50n,
          rawCostLi: 100n,
        },
        eventTime: latestHour,
        gameId: 'game-1',
        openId: 'open-a',
      },
    ]);
    prisma.game.findMany.mockResolvedValueOnce([gameRecord()]);
    const service = createService(prisma);

    const result = await service.queryLatest({
      admin: superAdmin,
      endedDataHour: '2026-05-07T11:00:00+08:00',
      startedDataHour: '2026-05-07T10:00:00+08:00',
    });

    expect(prisma.rawEcpm.findMany).toHaveBeenCalledWith({
      orderBy: {
        eventTime: 'desc',
      },
      select: {
        eventTime: true,
      },
      take: 1,
      where: {
        game: {
          deletedAt: null,
        },
      },
    });
    expect(prisma.rawEcpm.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          eventTime: {
            gte: latestHour,
            lt: new Date('2026-05-08T07:00:00.000Z'),
          },
        }),
      }),
    );
    expect(result.scope).toBe('latest');
  });

  it('selects latest ECPM hour inside company-admin scoped games', async () => {
    const latestHour = new Date('2026-05-08T06:00:00.000Z');
    const prisma = createFakePrisma();
    const accessControl = createAccessControl({
      companyIds: ['company-1'],
      gameAppIds: ['game-app-1'],
      gameIds: ['game-1'],
      isSuperAdmin: false,
    });
    prisma.rawEcpm.findMany.mockResolvedValueOnce([{ eventTime: latestHour }]);
    prisma.rawEcpm.groupBy.mockResolvedValueOnce([
      {
        _count: {
          _all: 1,
        },
        _max: {
          createdAt: new Date('2026-05-08T14:30:00.000Z'),
        },
        _sum: {
          displayAmountLi: 50n,
          rawCostLi: 100n,
        },
        eventTime: latestHour,
        gameId: 'game-1',
        openId: 'open-a',
      },
    ]);
    prisma.game.findMany.mockResolvedValueOnce([gameRecord()]);
    const service = createService(prisma, accessControl);

    const result = await service.queryLatest({
      admin: companyAdmin,
    });

    expect(prisma.rawEcpm.findMany).toHaveBeenCalledWith({
      orderBy: {
        eventTime: 'desc',
      },
      select: {
        eventTime: true,
      },
      take: 1,
      where: {
        game: {
          deletedAt: null,
        },
        gameId: {
          in: ['game-1'],
        },
      },
    });
    expect(prisma.rawEcpm.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          eventTime: {
            gte: latestHour,
            lt: new Date('2026-05-08T07:00:00.000Z'),
          },
          gameId: {
            in: ['game-1'],
          },
        }),
      }),
    );
    expect(result.scope).toBe('latest');
  });

  it('lists open_id rows for a selected game and hour range', async () => {
    const prisma = createFakePrisma();
    const rawRow = rawEcpmRecord();
    prisma.rawEcpm.findMany.mockResolvedValueOnce([rawRow]);
    const service = createService(prisma);

    const result = await service.queryGame({
      admin: superAdmin,
      endedDataHour: '2026-05-08T15:00:00+08:00',
      gameId: 'game-1',
      startedDataHour: '2026-05-08T14:00:00+08:00',
    });

    expect(prisma.rawEcpm.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ eventTime: 'desc' }, { id: 'desc' }],
        where: {
          eventTime: {
            gte: new Date('2026-05-08T06:00:00.000Z'),
            lt: new Date('2026-05-08T08:00:00.000Z'),
          },
          game: {
            deletedAt: null,
          },
          gameId: 'game-1',
        },
      }),
    );
    expect(result).toEqual({
      rows: [presentedRawRow(rawRow)],
      scope: 'game',
    });
  });

  it('lists rows for a selected user across bound open_ids', async () => {
    const prisma = createFakePrisma();
    const rawRow = rawEcpmRecord({
      openId: 'open-b',
      platformEventId: 'event-2',
    });
    prisma.gameOpenId.findMany.mockResolvedValueOnce([
      openIdRecord({ openId: 'open-a' }),
      openIdRecord({ openId: 'open-b' }),
    ]);
    prisma.rawEcpm.findMany.mockResolvedValueOnce([rawRow]);
    const service = createService(prisma);

    const result = await service.queryUser({
      admin: superAdmin,
      userId: 'user-1',
    });

    expect(prisma.gameOpenId.findMany).toHaveBeenCalledWith({
      orderBy: {
        createdAt: 'asc',
      },
      where: {
        userId: 'user-1',
      },
    });
    expect(prisma.rawEcpm.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          game: {
            deletedAt: null,
          },
          openId: {
            in: ['open-a', 'open-b'],
          },
        },
      }),
    );
    expect(result).toEqual({
      openIds: ['open-a', 'open-b'],
      rows: [presentedRawRow(rawRow)],
      scope: 'user',
      userId: 'user-1',
    });
  });

  it('lists rows for a selected open_id', async () => {
    const prisma = createFakePrisma();
    const rawRow = rawEcpmRecord();
    prisma.rawEcpm.findMany.mockResolvedValueOnce([rawRow]);
    const service = createService(prisma);

    const result = await service.queryOpenId({
      admin: superAdmin,
      openId: 'open-a',
    });

    expect(prisma.rawEcpm.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          game: {
            deletedAt: null,
          },
          openId: 'open-a',
        },
      }),
    );
    expect(result).toEqual({
      openId: 'open-a',
      rows: [presentedRawRow(rawRow)],
      scope: 'open_id',
    });
  });

  it('returns an empty list when a company admin has no scoped games', async () => {
    const prisma = createFakePrisma();
    const accessControl = createAccessControl({
      companyIds: [],
      gameAppIds: [],
      gameIds: [],
      isSuperAdmin: false,
    });
    const service = createService(prisma, accessControl);

    const result = await service.queryGame({
      admin: companyAdmin,
    });

    expect(accessControl.resolveReadScope).toHaveBeenCalledWith(companyAdmin);
    expect(prisma.rawEcpm.findMany).not.toHaveBeenCalled();
    expect(result).toEqual({
      rows: [],
      scope: 'game',
    });
  });

  it('filters company-admin queries to scoped game ids', async () => {
    const prisma = createFakePrisma();
    const accessControl = createAccessControl({
      companyIds: ['company-1'],
      gameAppIds: ['game-app-1'],
      gameIds: ['game-1'],
      isSuperAdmin: false,
    });
    const rawRow = rawEcpmRecord();
    prisma.rawEcpm.findMany.mockResolvedValueOnce([rawRow]);
    const service = createService(prisma, accessControl);

    const result = await service.queryGame({
      admin: companyAdmin,
    });

    expect(prisma.rawEcpm.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          game: {
            deletedAt: null,
          },
          gameId: {
            in: ['game-1'],
          },
        },
      }),
    );
    expect(result).toEqual({
      rows: [presentedRawRow(rawRow)],
      scope: 'game',
    });
  });

  it('rejects invalid calendar dates in data-hour filters', async () => {
    const prisma = createFakePrisma();
    prisma.rawEcpm.findMany.mockResolvedValueOnce([]);
    const service = createService(prisma);

    await expect(
      service.queryGame({
        admin: superAdmin,
        gameId: 'game-1',
        startedDataHour: '2026-02-31T00:00:00+08:00',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.rawEcpm.findMany).not.toHaveBeenCalled();
  });

  it('rejects non-hour data-hour filters', async () => {
    const prisma = createFakePrisma();
    prisma.rawEcpm.findMany.mockResolvedValueOnce([]);
    const service = createService(prisma);

    await expect(
      service.queryGame({
        admin: superAdmin,
        gameId: 'game-1',
        startedDataHour: '2026-05-08T14:30:00+08:00',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.rawEcpm.findMany).not.toHaveBeenCalled();
  });

  it('rejects data-hour filters outside the China timezone offset', async () => {
    const prisma = createFakePrisma();
    prisma.rawEcpm.findMany.mockResolvedValueOnce([]);
    const service = createService(prisma);

    await expect(
      service.queryGame({
        admin: superAdmin,
        gameId: 'game-1',
        startedDataHour: '2026-05-08T14:00:00Z',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.rawEcpm.findMany).not.toHaveBeenCalled();
  });

  it('validates hour filters before empty scoped-game short circuit', async () => {
    const prisma = createFakePrisma();
    const accessControl = createAccessControl({
      companyIds: [],
      gameAppIds: [],
      gameIds: [],
      isSuperAdmin: false,
    });
    const service = createService(prisma, accessControl);

    await expect(
      service.queryGame({
        admin: companyAdmin,
        startedDataHour: '2026-05-08T14:30:00+08:00',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.rawEcpm.findMany).not.toHaveBeenCalled();
  });

  it('validates hour filters before unauthorized game short circuit', async () => {
    const prisma = createFakePrisma();
    const accessControl = createAccessControl({
      companyIds: ['company-1'],
      gameAppIds: ['game-app-1'],
      gameIds: ['game-1'],
      isSuperAdmin: false,
    });
    const service = createService(prisma, accessControl);

    await expect(
      service.queryOpenId({
        admin: companyAdmin,
        gameId: 'game-2',
        openId: 'open-a',
        startedDataHour: '2026-02-31T00:00:00+08:00',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.rawEcpm.findMany).not.toHaveBeenCalled();
  });

  it('validates user date-hour filters before returning empty open_id rows', async () => {
    const prisma = createFakePrisma();
    prisma.gameOpenId.findMany.mockResolvedValueOnce([]);
    const service = createService(prisma);

    await expect(
      service.queryUser({
        admin: superAdmin,
        startedDataHour: '2026-05-08T14:00:00+08:00',
        endedDataHour: 'not-a-date',
        userId: 'user-without-open-ids',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

function createService(
  prisma = createFakePrisma(),
  accessControl = createAccessControl(),
) {
  return new EcpmDashboardService(prisma as never, accessControl as never);
}

function createFakePrisma() {
  return {
    game: {
      findMany: jest.fn(),
    },
    gameOpenId: {
      findMany: jest.fn(),
    },
    rawEcpm: {
      findMany: jest.fn(),
      groupBy: jest.fn(),
    },
  };
}

function createAccessControl(
  scope: AdminReadScope = {
    companyIds: undefined,
    gameAppIds: undefined,
    gameIds: undefined,
    isSuperAdmin: true,
  },
) {
  return {
    resolveReadScope: jest.fn(async () => scope),
  };
}

const superAdmin: AdminPrincipal = {
  role: 'SUPER_ADMIN',
  username: 'admin',
};

const companyAdmin: AdminPrincipal = {
  adminId: 'company-admin-1',
  displayName: 'Company Admin',
  role: 'COMPANY_ADMIN',
  username: 'company_admin',
};

function gameRecord() {
  return {
    company: {
      id: 'company-1',
      name: 'Company A',
    },
    companyId: 'company-1',
    gameAppId: 'game-app-1',
    id: 'game-1',
    name: 'Game A',
  };
}

function openIdRecord(input: Partial<ReturnType<typeof rawOpenIdRecord>> = {}) {
  return {
    ...rawOpenIdRecord(),
    ...input,
  };
}

function rawOpenIdRecord() {
  return {
    createdAt: new Date('2026-05-08T05:00:00.000Z'),
    gameId: 'game-1',
    id: 'open-row-1',
    openId: 'open-a',
    readableId: 'OPEN001',
    updatedAt: new Date('2026-05-08T05:00:00.000Z'),
    userId: 'user-1',
  };
}

function rawEcpmRecord(input: Partial<ReturnType<typeof rawEcpmRecordBase>> = {}) {
  return {
    ...rawEcpmRecordBase(),
    ...input,
  };
}

function rawEcpmRecordBase() {
  return {
    configSnapshot: {
      displayRatioPercent: 50,
    },
    createdAt: new Date('2026-05-08T14:30:00.000Z'),
    displayAmountLi: 50n,
    eventTime: new Date('2026-05-08T06:00:00.000Z'),
    game: gameRecord(),
    gameId: 'game-1',
    id: 'raw-1',
    openId: 'open-a',
    openIdRecord: {
      ...rawOpenIdRecord(),
      user: {
        id: 'user-1',
        readableId: 'USER001',
        username: 'alice',
      },
    },
    openIdRecordId: 'open-row-1',
    platformEventId: 'event-1',
    rawCostLi: 100n,
    status: 'PENDING',
  };
}

function presentedRawRow(row: ReturnType<typeof rawEcpmRecordBase>) {
  return {
    companyId: 'company-1',
    companyName: 'Company A',
    configSnapshot: row.configSnapshot,
    createdAt: row.createdAt.toISOString(),
    dataHour: '2026-05-08T14:00:00+08:00',
    displayAmount: {
      li: row.displayAmountLi.toString(),
      yuan: '0.05',
    },
    eventTime: row.eventTime.toISOString(),
    gameAppId: 'game-app-1',
    gameId: row.gameId,
    gameName: 'Game A',
    id: row.id,
    openId: row.openId,
    openIdRecordId: row.openIdRecordId,
    platformEventId: row.platformEventId,
    rawCost: {
      li: row.rawCostLi.toString(),
      yuan: '0.10',
    },
    status: row.status,
    userId: 'user-1',
    userReadableId: 'USER001',
    username: 'alice',
  };
}
