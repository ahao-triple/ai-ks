import { Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { SettlementStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { generateReadableId } from '../../domain/identity/readable-id';
import { computeDisplayAmount } from '../../domain/money/display-amount.strategy';
import {
  DEFAULT_PLATFORM_CONFIG,
  PlatformConfigService,
} from '../platform-config/platform-config.service';

type GameDataPrisma = Pick<
  PrismaService,
  'game' | 'gameOpenId' | 'rawEcpm'
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

    const platformConfig =
      (await this.platformConfigService?.getConfig()) ??
      DEFAULT_PLATFORM_CONFIG;
    const ratioPercent = platformConfig.displayRatioPercent;
    const savedRows = [];
    for (const row of input.rows) {
      const openIdRecord = await this.prisma.gameOpenId.findUnique({
        where: {
          openId: row.openId,
        },
      });
      const displayAmount = computeDisplayAmount({
        rawCostLi: row.rawCostLi,
        rule: {
          ratioPercent,
        },
      });
      const savedRow = await this.prisma.rawEcpm.upsert({
        create: {
          configSnapshot: {
            ratioPercent,
          },
          displayAmountLi: displayAmount.displayAmountLi,
          eventTime: row.eventTime,
          gameId: game.id,
          openId: row.openId,
          openIdRecordId: openIdRecord?.id,
          platformEventId: row.platformEventId,
          rawCostLi: row.rawCostLi,
          status: SettlementStatus.PENDING,
        },
        update: {
          configSnapshot: {
            ratioPercent,
          },
          displayAmountLi: displayAmount.displayAmountLi,
          eventTime: row.eventTime,
          openId: row.openId,
          openIdRecordId: openIdRecord?.id,
          rawCostLi: row.rawCostLi,
        },
        where: {
          gameId_platformEventId: {
            gameId: game.id,
            platformEventId: row.platformEventId,
          },
        },
      });

      savedRows.push(this.presentEcpmRow(savedRow, game.gameAppId));
    }

    return savedRows;
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
