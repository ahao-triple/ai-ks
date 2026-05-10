import { liToYuan } from '../../domain/money/amount';
import type { EcpmRow } from '../../features/game-data/game-data.store';

export function presentMoneyLi(value: bigint) {
  return {
    li: value.toString(),
    yuan: liToYuan(value),
  };
}

export function presentEcpmRow(row: EcpmRow) {
  return {
    platformEventId: row.platformEventId,
    gameAppId: row.gameAppId,
    openId: row.openId,
    rawCost: presentMoneyLi(row.rawCostLi),
    displayAmount: presentMoneyLi(row.displayAmountLi),
    eventTime: row.eventTime.toISOString(),
    configSnapshot: row.configSnapshot,
  };
}
