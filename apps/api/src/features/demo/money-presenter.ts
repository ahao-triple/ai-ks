import { liToYuan } from '../../domain/money/amount';
import { DemoEcpmRow } from './demo-store';

export function presentMoneyLi(value: bigint) {
  return {
    li: value.toString(),
    yuan: liToYuan(value),
  };
}

export function presentEcpmRow(row: DemoEcpmRow) {
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
