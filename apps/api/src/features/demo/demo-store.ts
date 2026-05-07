import { Injectable } from '@nestjs/common';
import { SettlementStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { generateReadableId } from '../../domain/identity/readable-id';
import { computeDisplayAmount } from '../../domain/money/display-amount.strategy';

const DEMO_COMPANY_ID = 'demo-company-001';
const DEMO_GAME_ID = 'demo-game-001';
const DEMO_GAME_APP_ID = 'demo_ks_game';
const DEMO_GAME_SECRET = 'demo_ks_secret';

type DemoPrisma = Pick<PrismaService, 'company' | 'game' | 'gameOpenId' | 'rawEcpm'>;

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

export type DemoGame = {
  id: string;
  companyId: string;
  companyName: string;
  gameAppId: string;
  gameSecret: string;
  name: string;
};

export type DemoOpenId = {
  id: string;
  gameAppId: string;
  openId: string;
  readableId: string;
  createdAt: Date;
};

export type DemoEcpmInputRow = {
  platformEventId: string;
  openId: string;
  rawCostLi: bigint;
  eventTime: Date;
};

export type DemoEcpmRow = DemoEcpmInputRow & {
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
export class DemoStore {
  constructor(private readonly prisma: DemoPrisma) {}

  async ensureDemoData() {
    await this.prisma.company.upsert({
      create: {
        id: DEMO_COMPANY_ID,
        balanceLi: 0n,
        name: '测试公司',
      },
      update: {
        name: '测试公司',
      },
      where: {
        id: DEMO_COMPANY_ID,
      },
    });

    await this.prisma.game.upsert({
      create: {
        id: DEMO_GAME_ID,
        budgetLi: 0n,
        companyId: DEMO_COMPANY_ID,
        gameAppId: DEMO_GAME_APP_ID,
        gameSecret: DEMO_GAME_SECRET,
        name: '测试游戏',
      },
      update: {
        gameSecret: DEMO_GAME_SECRET,
        name: '测试游戏',
      },
      where: {
        gameAppId: DEMO_GAME_APP_ID,
      },
    });
  }

  async listGames(): Promise<DemoGame[]> {
    await this.ensureDemoData();
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

  async findGameByAppId(gameAppId: string): Promise<DemoGame | undefined> {
    await this.ensureDemoData();
    const game = await this.prisma.game.findUnique({
      include: {
        company: true,
      },
      where: {
        gameAppId,
      },
    });

    return game ? this.presentGame(game) : undefined;
  }

  async listOpenIds(gameAppId: string): Promise<DemoOpenId[]> {
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
  }): Promise<DemoOpenId> {
    const game = await this.findGameByAppId(input.gameAppId);
    if (!game) {
      throw new Error(`Game ${input.gameAppId} is not configured`);
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

  async addEcpmRows(input: { gameAppId: string; rows: DemoEcpmInputRow[] }) {
    const game = await this.findGameByAppId(input.gameAppId);
    if (!game) {
      throw new Error(`Game ${input.gameAppId} is not configured`);
    }

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
          ratioPercent: 50,
        },
      });
      const savedRow = await this.prisma.rawEcpm.upsert({
        create: {
          configSnapshot: {
            ratioPercent: 50,
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
            ratioPercent: 50,
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

  private presentGame(game: GameWithCompany): DemoGame {
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

  private presentEcpmRow(
    row: RawEcpmRecord,
    gameAppId: string,
  ): DemoEcpmRow {
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
