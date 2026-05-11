import { Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { Prisma, SettlementStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { generateReadableId } from '../../domain/identity/readable-id';
import { computeDisplayAmount } from '../../domain/money/display-amount.strategy';
import {
  DEFAULT_PLATFORM_CONFIG,
  PlatformConfigService,
} from '../platform-config/platform-config.service';

type GameDataPrisma = Pick<
  PrismaService,
  'game' | 'gameOpenId' | 'rawEcpm' | '$transaction' | '$executeRaw' | '$queryRaw'
>;

type GameWithCompany = {
  id: string;
  companyId: string;
  company?: {
    name: string;
  } | null;
  gameAppId: string;
  gameSecret: string;
  name: string;
};

type OpenIdRecord = {
  id: string;
  createdAt: Date;
  openId: string;
  readableId: string;
};

type RawEcpmRecord = {
  configSnapshot: unknown;
  displayAmountLi: bigint;
  eventTime: Date;
  gameId: string;
  openId: string;
  platformEventId: string;
  rawCostLi: bigint;
};

export type GameDataGame = {
  id: string;
  companyId: string;
  companyName: string;
  gameAppId: string;
  gameSecret: string;
  name: string;
};

export type GameDataOpenId = {
  id: string;
  gameAppId: string;
  openId: string;
  readableId: string;
  createdAt: Date;
};

export type EcpmInputRow = {
  platformEventId: string;
  openId: string;
  rawCostLi: bigint;
  eventTime: Date;
};

export type EcpmRow = EcpmInputRow & {
  gameAppId: string;
  displayAmountLi: bigint;
  configSnapshot: {
    ratioPercent: number;
  };
};

export type QueryEarningsInput = {
  identity: string;
  startAt: Date;
  endAt: Date;
};

@Injectable()
export class GameDataStore {
  constructor(
    @Inject(PrismaService) private readonly prisma: GameDataPrisma,
    @Optional()
    private readonly platformConfigService?: Pick<
      PlatformConfigService,
      'getConfig'
    >,
  ) {}

  async listGames(): Promise<GameDataGame[]> {
    const games = await this.prisma.game.findMany({
      include: {
        company: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
      where: {
        deletedAt: null,
      },
    });

    return games.map((game) => this.presentGame(game));
  }

  async findGameByAppId(gameAppId: string): Promise<GameDataGame | undefined> {
    const game = await this.prisma.game.findUnique({
      include: {
        company: true,
      },
      where: {
        gameAppId,
      },
    });

    return game && game.deletedAt === null ? this.presentGame(game) : undefined;
  }

  async listOpenIds(gameAppId: string): Promise<GameDataOpenId[]> {
    const game = await this.findGameByAppId(gameAppId);
    if (!game) {
      return [];
    }

    const records = await this.prisma.gameOpenId.findMany({
      orderBy: {
        createdAt: 'asc',
      },
      where: {
        gameId: game.id,
      },
    });

    return records.map((record) => this.presentOpenId(record, game.gameAppId));
  }

  async upsertOpenId(input: {
    gameAppId: string;
    openId: string;
    sessionKey?: string;
  }): Promise<GameDataOpenId> {
    const game = await this.findGameByAppId(input.gameAppId);
    if (!game) {
      throw new NotFoundException(`游戏 ${input.gameAppId} 未配置或已删除`);
    }

    const readableId = generateReadableId(`${input.gameAppId}:${input.openId}`);
    const record = await this.prisma.gameOpenId.upsert({
      create: {
        gameId: game.id,
        openId: input.openId,
        readableId,
      },
      update: {
        gameId: game.id,
      },
      where: {
        openId: input.openId,
      },
    });

    return this.presentOpenId(record, game.gameAppId);
  }

  async addEcpmRows(input: { gameAppId: string; rows: EcpmInputRow[] }) {
    const game = await this.findGameByAppId(input.gameAppId);
    if (!game) {
      throw new NotFoundException(`游戏 ${input.gameAppId} 未配置或已删除`);
    }
    if (input.rows.length === 0) {
      return [];
    }

    const platformConfig =
      (await this.platformConfigService?.getConfig()) ??
      DEFAULT_PLATFORM_CONFIG;
    const ratioPercent = platformConfig.displayRatioPercent;

    // 性能关键：原实现 N 行 = 2N 次远端 SQL（findUnique + upsert，每次 RTT ~300ms）。
    // 改成两条 SQL：一次批量查 open_id 关联 + 一句 INSERT ... ON CONFLICT DO UPDATE。
    const uniqueOpenIds = Array.from(new Set(input.rows.map((r) => r.openId)));
    const openIdRecords = await this.prisma.gameOpenId.findMany({
      where: { openId: { in: uniqueOpenIds } },
      select: { id: true, openId: true },
    });
    const openIdMap = new Map(openIdRecords.map((r) => [r.openId, r.id]));
    const configSnapshot = JSON.stringify({ ratioPercent });
    const status = SettlementStatus.PENDING;

    const tuples = input.rows.map((row) => {
      const displayAmount = computeDisplayAmount({
        rawCostLi: row.rawCostLi,
        rule: { ratioPercent },
      });
      return Prisma.sql`(
        gen_random_uuid(),
        ${game.id},
        ${openIdMap.get(row.openId) ?? null},
        ${row.platformEventId},
        ${row.openId},
        ${row.rawCostLi}::bigint,
        ${displayAmount.displayAmountLi}::bigint,
        ${row.eventTime},
        ${status}::"SettlementStatus",
        ${configSnapshot}::jsonb,
        NOW()
      )`;
    });

    await this.prisma.$executeRaw`
      INSERT INTO raw_ecpms (
        id, game_id, open_id_record_id, platform_event_id, open_id,
        raw_cost_li, display_amount_li, event_time, status, config_snapshot, created_at
      ) VALUES ${Prisma.join(tuples)}
      ON CONFLICT (game_id, platform_event_id) DO UPDATE SET
        open_id_record_id = EXCLUDED.open_id_record_id,
        open_id = EXCLUDED.open_id,
        raw_cost_li = EXCLUDED.raw_cost_li,
        display_amount_li = EXCLUDED.display_amount_li,
        event_time = EXCLUDED.event_time,
        config_snapshot = EXCLUDED.config_snapshot
    `;

    // 用一次 findMany 把刚写入的行（含 update 后的）拉回来供调用方使用
    const savedRowEntities = await this.prisma.rawEcpm.findMany({
      where: {
        gameId: game.id,
        platformEventId: { in: input.rows.map((r) => r.platformEventId) },
      },
    });
    return savedRowEntities.map((row) =>
      this.presentEcpmRow(row, game.gameAppId),
    );
  }

  async queryEarnings(input: QueryEarningsInput) {
    const matchedRecord = await this.findOpenIdByIdentity(input.identity);
    const openId = matchedRecord?.openId ?? input.identity;
    const rows = await this.prisma.rawEcpm.findMany({
      orderBy: {
        eventTime: 'asc',
      },
      where: {
        eventTime: {
          gte: input.startAt,
          lt: input.endAt,
        },
        openId,
      },
    });
    const gameById = new Map(
      (await this.listGames()).map((game) => [game.id, game.gameAppId]),
    );
    const presentedRows = rows.map((row) =>
      this.presentEcpmRow(row, gameById.get(row.gameId) ?? ''),
    );

    return {
      identity: input.identity,
      openId,
      readableId: matchedRecord?.readableId,
      rows: presentedRows,
      totalDisplayAmountLi: sum(
        presentedRows.map((row) => row.displayAmountLi),
      ),
      totalRawCostLi: sum(presentedRows.map((row) => row.rawCostLi)),
    };
  }

  private async findOpenIdByIdentity(
    identity: string,
  ): Promise<OpenIdRecord | null> {
    const byOpenId = await this.prisma.gameOpenId.findUnique({
      where: {
        openId: identity,
      },
    });
    if (byOpenId) {
      return byOpenId;
    }

    return this.prisma.gameOpenId.findUnique({
      where: {
        readableId: identity,
      },
    });
  }

  private presentGame(game: GameWithCompany): GameDataGame {
    return {
      id: game.id,
      companyId: game.companyId,
      companyName: game.company?.name ?? '',
      gameAppId: game.gameAppId,
      gameSecret: game.gameSecret,
      name: game.name,
    };
  }

  private presentOpenId(record: OpenIdRecord, gameAppId: string) {
    return {
      id: record.id,
      createdAt: record.createdAt,
      gameAppId,
      openId: record.openId,
      readableId: record.readableId,
    };
  }

  private presentEcpmRow(row: RawEcpmRecord, gameAppId: string): EcpmRow {
    return {
      displayAmountLi: row.displayAmountLi,
      eventTime: row.eventTime,
      gameAppId,
      openId: row.openId,
      platformEventId: row.platformEventId,
      rawCostLi: row.rawCostLi,
      configSnapshot: {
        ratioPercent: readRatioPercent(row.configSnapshot),
      },
    };
  }
}

function readRatioPercent(snapshot: unknown) {
  if (snapshot && typeof snapshot === 'object' && 'ratioPercent' in snapshot) {
    const ratioPercent = (snapshot as { ratioPercent?: unknown }).ratioPercent;
    return typeof ratioPercent === 'number' ? ratioPercent : 50;
  }

  return 50;
}

function sum(values: bigint[]) {
  return values.reduce((total, value) => total + value, 0n);
}
