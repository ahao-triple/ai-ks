import { Injectable } from '@nestjs/common';
import { generateReadableId } from '../../domain/identity/readable-id';
import { computeDisplayAmount } from '../../domain/money/display-amount.strategy';

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
  sessionKey?: string;
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
  private readonly games: DemoGame[] = [
    {
      id: 'demo-game-001',
      companyId: 'demo-company-001',
      companyName: '测试公司',
      gameAppId: 'demo_ks_game',
      gameSecret: 'demo_ks_secret',
      name: '测试游戏',
    },
  ];

  private readonly openIds = new Map<string, DemoOpenId>();
  private readonly ecpms = new Map<string, DemoEcpmRow>();

  listGames(): DemoGame[] {
    return this.games.map((game) => ({ ...game }));
  }

  findGameByAppId(gameAppId: string): DemoGame | undefined {
    const game = this.games.find((item) => item.gameAppId === gameAppId);
    return game ? { ...game } : undefined;
  }

  listOpenIds(gameAppId: string): DemoOpenId[] {
    return Array.from(this.openIds.values())
      .filter((record) => record.gameAppId === gameAppId)
      .map((record) => ({ ...record }));
  }

  upsertOpenId(input: {
    gameAppId: string;
    openId: string;
    sessionKey?: string;
  }): DemoOpenId {
    const existing = this.openIds.get(input.openId);
    if (existing) {
      existing.sessionKey = input.sessionKey;
      return { ...existing };
    }

    const record: DemoOpenId = {
      id: generateReadableId(`record:${input.gameAppId}:${input.openId}`),
      gameAppId: input.gameAppId,
      openId: input.openId,
      readableId: generateReadableId(`${input.gameAppId}:${input.openId}`),
      sessionKey: input.sessionKey,
      createdAt: new Date(),
    };
    this.openIds.set(input.openId, record);
    return { ...record };
  }

  addEcpmRows(input: { gameAppId: string; rows: DemoEcpmInputRow[] }) {
    const savedRows = input.rows.map((row) => {
      const displayAmount = computeDisplayAmount({
        rawCostLi: row.rawCostLi,
        rule: {
          ratioPercent: 50,
        },
      });
      const savedRow: DemoEcpmRow = {
        ...row,
        gameAppId: input.gameAppId,
        displayAmountLi: displayAmount.displayAmountLi,
        configSnapshot: {
          ratioPercent: 50,
        },
      };
      this.ecpms.set(`${input.gameAppId}:${row.platformEventId}`, savedRow);
      return { ...savedRow };
    });

    return savedRows;
  }

  queryEarnings(input: QueryEarningsInput) {
    const matchedRecord = Array.from(this.openIds.values()).find(
      (record) =>
        record.openId === input.identity || record.readableId === input.identity,
    );
    const openId = matchedRecord?.openId ?? input.identity;
    const rows = Array.from(this.ecpms.values()).filter(
      (row) =>
        row.openId === openId &&
        row.eventTime >= input.startAt &&
        row.eventTime < input.endAt,
    );

    return {
      identity: input.identity,
      openId,
      readableId: matchedRecord?.readableId,
      rows: rows.map((row) => ({ ...row })),
      totalDisplayAmountLi: sum(rows.map((row) => row.displayAmountLi)),
      totalRawCostLi: sum(rows.map((row) => row.rawCostLi)),
    };
  }
}

function sum(values: bigint[]) {
  return values.reduce((total, value) => total + value, 0n);
}
