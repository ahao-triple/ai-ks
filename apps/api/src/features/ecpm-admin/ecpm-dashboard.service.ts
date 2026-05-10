import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { Prisma, SettlementStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  AdminAccessControlService,
  type AdminReadScope,
} from '../admin-auth/admin-access-control.service';
import type { AdminPrincipal } from '../admin-auth/admin-auth.service';
import { presentMoneyLi } from '../../common/presenters/money-presenter';

export type EcpmDashboardScope =
  | 'company'
  | 'game'
  | 'latest'
  | 'open_id'
  | 'user';

export type EcpmDashboardQueryInput = {
  admin: AdminPrincipal;
  companyId?: string;
  gameId?: string;
  openId?: string;
  page?: number;
  pageSize?: number;
  startedDataHour?: string;
  endedDataHour?: string;
  status?: SettlementStatus;
  userId?: string;
};

type EcpmDashboardPrisma = Pick<
  PrismaService,
  'game' | 'gameOpenId' | 'rawEcpm'
>;

type DashboardGame = {
  company?: {
    id: string;
    name: string;
  } | null;
  companyId: string;
  gameAppId: string;
  id: string;
  name: string;
};

type DashboardOpenId = {
  createdAt?: Date;
  gameId: string;
  openId: string;
};

type DashboardRawEcpmRow = {
  configSnapshot: Prisma.JsonValue;
  createdAt: Date;
  displayAmountLi: bigint;
  eventTime: Date;
  game?: DashboardGame | null;
  gameId: string;
  id: string;
  openId: string;
  openIdRecord?: {
    user?: {
      id: string;
      readableId: string;
      username: string;
    } | null;
    userId?: string | null;
  } | null;
  openIdRecordId: string | null;
  platformEventId: string;
  rawCostLi: bigint;
  status: SettlementStatus;
};

type DashboardGroupRow = {
  _count: {
    _all: number;
  };
  _max: {
    createdAt: Date | null;
  };
  _sum: {
    displayAmountLi: bigint | null;
    rawCostLi: bigint | null;
  };
  eventTime: Date;
  gameId: string;
  openId: string;
};

type GameSelector =
  | {
      kind: 'all';
    }
  | {
      gameId: string;
      kind: 'one';
    }
  | {
      gameIds: string[];
      kind: 'many';
    };

const CHINA_TIMEZONE_OFFSET_MS = 8 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;
const DATA_HOUR_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?\+08:00$/;

@Injectable()
export class EcpmDashboardService {
  constructor(
    @Inject(PrismaService) private readonly prisma: EcpmDashboardPrisma,
    @Inject(AdminAccessControlService)
    private readonly accessControl: AdminAccessControlService,
  ) {}

  async queryCompany(input: EcpmDashboardQueryInput) {
    const scope = await this.accessControl.resolveReadScope(input.admin);
    if (!hasDataHourRange(input)) {
      return this.queryLatestCompanyInScope(input, scope, 'company');
    }

    return this.queryCompanyInScope(input, scope);
  }

  async queryGame(input: EcpmDashboardQueryInput) {
    const scope = await this.accessControl.resolveReadScope(input.admin);
    const where = this.buildRawEcpmWhere(input, scope);
    if (where === false) {
      return {
        rows: [],
        scope: 'game' as const,
      };
    }

    const rows = await this.findRawRows(where, input);

    return {
      rows: rows.map(presentRawEcpmRow),
      scope: 'game' as const,
    };
  }

  async queryUser(input: EcpmDashboardQueryInput) {
    if (!input.userId) {
      throw new BadRequestException('userId is required');
    }

    const scope = await this.accessControl.resolveReadScope(input.admin);
    const eventTime = buildDataHourFilter(input);
    const selector = this.resolveGameSelector(input, scope);
    if (selector === false) {
      return {
        openIds: [],
        rows: [],
        scope: 'user' as const,
        userId: input.userId,
      };
    }

    const openIdRecords = (await this.prisma.gameOpenId.findMany({
      orderBy: {
        createdAt: 'asc',
      },
      where: {
        ...this.buildGameOpenIdWhere(selector),
        userId: input.userId,
      },
    })) as DashboardOpenId[];
    const openIds = openIdRecords.map((record) => record.openId);
    if (openIds.length === 0) {
      return {
        openIds,
        rows: [],
        scope: 'user' as const,
        userId: input.userId,
      };
    }

    const where = this.buildRawEcpmWhere(input, scope, eventTime, {
      openId: {
        in: openIds,
      },
    });
    if (where === false) {
      return {
        openIds,
        rows: [],
        scope: 'user' as const,
        userId: input.userId,
      };
    }

    const rows = await this.findRawRows(where, input);

    return {
      openIds,
      rows: rows.map(presentRawEcpmRow),
      scope: 'user' as const,
      userId: input.userId,
    };
  }

  async queryOpenId(input: EcpmDashboardQueryInput) {
    if (!input.openId) {
      throw new BadRequestException('openId is required');
    }

    const scope = await this.accessControl.resolveReadScope(input.admin);
    const where = this.buildRawEcpmWhere(input, scope, undefined, {
      openId: input.openId,
    });
    if (where === false) {
      return {
        openId: input.openId,
        rows: [],
        scope: 'open_id' as const,
      };
    }

    const rows = await this.findRawRows(where, input);

    return {
      openId: input.openId,
      rows: rows.map(presentRawEcpmRow),
      scope: 'open_id' as const,
    };
  }

  async queryLatest(input: EcpmDashboardQueryInput) {
    const scope = await this.accessControl.resolveReadScope(input.admin);

    return this.queryLatestCompanyInScope(
      withoutDataHourRange(input),
      scope,
      'latest',
    );
  }

  private async queryLatestCompanyInScope(
    input: EcpmDashboardQueryInput,
    scope: AdminReadScope,
    resultScope: 'company' | 'latest',
  ) {
    const latestWhere = this.buildRawEcpmWhere(input, scope);
    if (latestWhere === false) {
      return {
        rows: [],
        scope: resultScope,
      };
    }

    const latestRows = (await this.prisma.rawEcpm.findMany({
      orderBy: {
        eventTime: 'desc',
      },
      select: {
        eventTime: true,
      },
      take: 1,
      where: latestWhere,
    })) as Array<{ eventTime: Date }>;
    const latest = latestRows[0];
    if (!latest) {
      return {
        rows: [],
        scope: resultScope,
      };
    }

    const latestHourStart = floorChinaHour(latest.eventTime);

    return this.queryCompanyInScope(input, scope, {
      gte: latestHourStart,
      lt: new Date(latestHourStart.getTime() + HOUR_MS),
    }, resultScope);
  }

  private async queryCompanyInScope(
    input: EcpmDashboardQueryInput,
    scope: AdminReadScope,
    eventTime?: Prisma.DateTimeFilter,
    resultScope: 'company' | 'latest' = 'company',
  ) {
    const where = this.buildRawEcpmWhere(input, scope, eventTime);
    if (where === false) {
      return {
        rows: [],
        scope: resultScope,
      };
    }

    const groupedRows = (await this.prisma.rawEcpm.groupBy({
      _count: {
        _all: true,
      },
      _max: {
        createdAt: true,
      },
      _sum: {
        displayAmountLi: true,
        rawCostLi: true,
      },
      by: ['gameId', 'eventTime', 'openId'],
      where,
    } as never)) as DashboardGroupRow[];
    if (groupedRows.length === 0) {
      return {
        rows: [],
        scope: resultScope,
      };
    }

    const games = (await this.prisma.game.findMany({
      include: {
        company: true,
      },
      where: {
        id: {
          in: uniqueSorted(groupedRows.map((row) => row.gameId)),
        },
      },
    })) as DashboardGame[];
    const gameById = new Map(games.map((game) => [game.id, game]));
    const aggregates = new Map<
      string,
      {
        dataHour: string;
        displayAmountLi: bigint;
        eventCount: number;
        gameId: string;
        openIds: Set<string>;
        rawCostLi: bigint;
        updatedAt: Date | null;
      }
    >();

    for (const row of groupedRows) {
      const dataHour = formatChinaDataHour(row.eventTime);
      const key = `${row.gameId}:${dataHour}`;
      const aggregate = aggregates.get(key) ?? {
        dataHour,
        displayAmountLi: 0n,
        eventCount: 0,
        gameId: row.gameId,
        openIds: new Set<string>(),
        rawCostLi: 0n,
        updatedAt: null,
      };

      aggregate.displayAmountLi += row._sum.displayAmountLi ?? 0n;
      aggregate.eventCount += row._count._all;
      aggregate.openIds.add(row.openId);
      aggregate.rawCostLi += row._sum.rawCostLi ?? 0n;
      if (
        row._max.createdAt &&
        (!aggregate.updatedAt || row._max.createdAt > aggregate.updatedAt)
      ) {
        aggregate.updatedAt = row._max.createdAt;
      }
      aggregates.set(key, aggregate);
    }

    const rows = Array.from(aggregates.values())
      .map((aggregate) => {
        const game = gameById.get(aggregate.gameId);

        return {
          companyId: game?.company?.id ?? game?.companyId ?? '',
          companyName: game?.company?.name ?? '',
          dataHour: aggregate.dataHour,
          displayAmount: presentMoneyLi(aggregate.displayAmountLi),
          eventCount: aggregate.eventCount,
          gameAppId: game?.gameAppId ?? '',
          gameId: aggregate.gameId,
          gameName: game?.name ?? '',
          openIdCount: aggregate.openIds.size,
          rawCost: presentMoneyLi(aggregate.rawCostLi),
          updatedAt: aggregate.updatedAt?.toISOString() ?? null,
        };
      })
      .sort((left, right) => {
        const hourComparison = right.dataHour.localeCompare(left.dataHour);
        if (hourComparison !== 0) {
          return hourComparison;
        }

        const companyComparison = left.companyName.localeCompare(
          right.companyName,
        );
        if (companyComparison !== 0) {
          return companyComparison;
        }

        const companyIdComparison = left.companyId.localeCompare(
          right.companyId,
        );
        if (companyIdComparison !== 0) {
          return companyIdComparison;
        }

        const gameNameComparison = left.gameName.localeCompare(right.gameName);
        if (gameNameComparison !== 0) {
          return gameNameComparison;
        }

        return left.gameId.localeCompare(right.gameId);
      });

    return {
      rows: paginate(rows, input),
      scope: resultScope,
    };
  }

  private async findRawRows(
    where: Prisma.RawEcpmWhereInput,
    input: EcpmDashboardQueryInput,
  ) {
    return (await this.prisma.rawEcpm.findMany({
      include: {
        game: {
          include: {
            company: true,
          },
        },
        openIdRecord: {
          include: {
            user: true,
          },
        },
      },
      orderBy: [{ eventTime: 'desc' }, { id: 'desc' }],
      ...paginationArgs(input),
      where,
    })) as DashboardRawEcpmRow[];
  }

  private buildRawEcpmWhere(
    input: EcpmDashboardQueryInput,
    scope: AdminReadScope,
    eventTime?: Prisma.DateTimeFilter,
    extraWhere: Prisma.RawEcpmWhereInput = {},
  ): Prisma.RawEcpmWhereInput | false {
    const eventTimeFilter = eventTime ?? buildDataHourFilter(input);
    const selector = this.resolveGameSelector(input, scope);
    if (selector === false) {
      return false;
    }

    const where: Prisma.RawEcpmWhereInput = {
      game: {
        deletedAt: null,
        ...(input.companyId ? { companyId: input.companyId } : {}),
      },
      ...this.buildRawEcpmGameWhere(selector),
      ...extraWhere,
    };
    if (eventTimeFilter) {
      where.eventTime = eventTimeFilter;
    }
    if (input.status) {
      where.status = input.status;
    }

    return where;
  }

  private resolveGameSelector(
    input: EcpmDashboardQueryInput,
    scope: AdminReadScope,
  ): GameSelector | false {
    if (scope.isSuperAdmin) {
      return input.gameId
        ? {
            gameId: input.gameId,
            kind: 'one',
          }
        : {
            kind: 'all',
          };
    }

    const scopedGameIds = scope.gameIds ?? [];
    if (scopedGameIds.length === 0) {
      return false;
    }

    if (input.gameId) {
      return scopedGameIds.includes(input.gameId)
        ? {
            gameId: input.gameId,
            kind: 'one',
          }
        : false;
    }

    return {
      gameIds: scopedGameIds,
      kind: 'many',
    };
  }

  private buildRawEcpmGameWhere(
    selector: GameSelector,
  ): Prisma.RawEcpmWhereInput {
    if (selector.kind === 'one') {
      return {
        gameId: selector.gameId,
      };
    }

    if (selector.kind === 'many') {
      return {
        gameId: {
          in: selector.gameIds,
        },
      };
    }

    return {};
  }

  private buildGameOpenIdWhere(
    selector: GameSelector,
  ): Prisma.GameOpenIdWhereInput {
    if (selector.kind === 'one') {
      return {
        gameId: selector.gameId,
      };
    }

    if (selector.kind === 'many') {
      return {
        gameId: {
          in: selector.gameIds,
        },
      };
    }

    return {};
  }
}

function presentRawEcpmRow(row: DashboardRawEcpmRow) {
  const game = row.game;
  const company = game?.company;
  const user = row.openIdRecord?.user;

  return {
    companyId: company?.id ?? game?.companyId ?? '',
    companyName: company?.name ?? '',
    configSnapshot: row.configSnapshot,
    createdAt: row.createdAt.toISOString(),
    dataHour: formatChinaDataHour(row.eventTime),
    displayAmount: presentMoneyLi(row.displayAmountLi),
    eventTime: row.eventTime.toISOString(),
    gameAppId: game?.gameAppId ?? '',
    gameId: row.gameId,
    gameName: game?.name ?? '',
    id: row.id,
    openId: row.openId,
    openIdRecordId: row.openIdRecordId,
    platformEventId: row.platformEventId,
    rawCost: presentMoneyLi(row.rawCostLi),
    status: row.status,
    userId: user?.id ?? row.openIdRecord?.userId ?? null,
    userReadableId: user?.readableId ?? null,
    username: user?.username ?? null,
  };
}

function buildDataHourFilter(input: EcpmDashboardQueryInput) {
  const startedAt = input.startedDataHour
    ? parseDataHour(input.startedDataHour, 'startedDataHour')
    : undefined;
  const endedAt = input.endedDataHour
    ? parseDataHour(input.endedDataHour, 'endedDataHour')
    : undefined;

  if (startedAt && endedAt && startedAt > endedAt) {
    throw new BadRequestException('startedDataHour must be before endedDataHour');
  }

  const filter: Prisma.DateTimeFilter = {};
  if (startedAt) {
    filter.gte = startedAt;
  }
  if (endedAt) {
    filter.lt = new Date(endedAt.getTime() + HOUR_MS);
  }

  return Object.keys(filter).length > 0 ? filter : undefined;
}

function hasDataHourRange(input: EcpmDashboardQueryInput) {
  return Boolean(input.startedDataHour || input.endedDataHour);
}

function withoutDataHourRange(
  input: EcpmDashboardQueryInput,
): EcpmDashboardQueryInput {
  return {
    ...input,
    endedDataHour: undefined,
    startedDataHour: undefined,
  };
}

function parseDataHour(value: string, fieldName: string) {
  const match = DATA_HOUR_PATTERN.exec(value);
  if (!match) {
    throw new BadRequestException(`Invalid ${fieldName}`);
  }

  const [
    ,
    yearText,
    monthText,
    dayText,
    hourText,
    minuteText,
    secondText,
    millisecondText,
  ] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  const millisecond = millisecondText ? Number(millisecondText) : 0;

  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > daysInMonth(year, month) ||
    hour > 23 ||
    minute !== 0 ||
    second !== 0 ||
    millisecond !== 0
  ) {
    throw new BadRequestException(`Invalid ${fieldName}`);
  }

  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    throw new BadRequestException(`Invalid ${fieldName}`);
  }

  return new Date(timestamp);
}

function daysInMonth(year: number, month: number) {
  return [
    31,
    isLeapYear(year) ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ][month - 1];
}

function isLeapYear(year: number) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function floorChinaHour(date: Date) {
  const chinaTime = date.getTime() + CHINA_TIMEZONE_OFFSET_MS;
  const flooredChinaTime = Math.floor(chinaTime / HOUR_MS) * HOUR_MS;

  return new Date(flooredChinaTime - CHINA_TIMEZONE_OFFSET_MS);
}

function formatChinaDataHour(date: Date) {
  const hourStart = floorChinaHour(date);
  const chinaDate = new Date(hourStart.getTime() + CHINA_TIMEZONE_OFFSET_MS);

  return [
    chinaDate.getUTCFullYear(),
    '-',
    pad2(chinaDate.getUTCMonth() + 1),
    '-',
    pad2(chinaDate.getUTCDate()),
    'T',
    pad2(chinaDate.getUTCHours()),
    ':00:00+08:00',
  ].join('');
}

function pad2(value: number) {
  return String(value).padStart(2, '0');
}

function paginationArgs(input: EcpmDashboardQueryInput) {
  const pageSize = clampInteger(input.pageSize, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const page = clampInteger(input.page, DEFAULT_PAGE, Number.MAX_SAFE_INTEGER);

  return {
    skip: (page - 1) * pageSize,
    take: pageSize,
  };
}

function paginate<T>(rows: T[], input: EcpmDashboardQueryInput) {
  const { skip, take } = paginationArgs(input);

  return rows.slice(skip, skip + take);
}

function clampInteger(
  value: number | undefined,
  defaultValue: number,
  maximum: number,
) {
  if (!Number.isFinite(value)) {
    return defaultValue;
  }

  return Math.min(Math.max(Math.trunc(value!), 1), maximum);
}

function uniqueSorted(values: string[]) {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}
