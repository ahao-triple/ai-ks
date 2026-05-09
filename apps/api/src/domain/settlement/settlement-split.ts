export type SettlementSplitRule = {
  defaultAgentRatioPercent: number;
  directAgentRatioPercent: number;
  feeRatioPercent: number;
  parentAgentRatioPercent: number;
  userRatioPercent: number;
};

export type SettlementSplit = {
  defaultAgentAmountLi: bigint;
  directAgentAmountLi: bigint;
  feeAmountLi: bigint;
  parentAgentAmountLi: bigint;
  totalAmountLi: bigint;
  userAmountLi: bigint;
};

export function computeSettlementSplit(input: {
  displayAmountLi: bigint;
  rule: SettlementSplitRule;
}): SettlementSplit {
  if (input.displayAmountLi < 0n) {
    throw new Error('Display amount cannot be negative');
  }

  const userAmountLi = floorPercentOfLi(
    input.displayAmountLi,
    input.rule.userRatioPercent,
  );
  const directAgentAmountLi = floorPercentOfLi(
    input.displayAmountLi,
    input.rule.directAgentRatioPercent,
  );
  const parentAgentAmountLi = floorPercentOfLi(
    input.displayAmountLi,
    input.rule.parentAgentRatioPercent,
  );
  const defaultAgentAmountLi = floorPercentOfLi(
    input.displayAmountLi,
    input.rule.defaultAgentRatioPercent,
  );
  const allocatedLi =
    userAmountLi +
    directAgentAmountLi +
    parentAgentAmountLi +
    defaultAgentAmountLi;

  return {
    defaultAgentAmountLi,
    directAgentAmountLi,
    feeAmountLi: input.displayAmountLi - allocatedLi,
    parentAgentAmountLi,
    totalAmountLi: input.displayAmountLi,
    userAmountLi,
  };
}

function floorPercentOfLi(value: bigint, percent: number) {
  if (!Number.isInteger(percent) || percent < 0 || percent > 100) {
    throw new Error('Percent must be an integer from 0 to 100');
  }

  return (value * BigInt(percent)) / 100n;
}
