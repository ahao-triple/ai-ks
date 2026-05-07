import { percentOfLi } from './amount';

export type DisplayAmountRule = {
  ratioPercent: number;
  maxDisplayLi?: bigint;
  minDisplayLi?: bigint;
  middleDisplayLi?: bigint;
  topDisplayLi?: bigint;
  dropPercent?: number;
};

export type DisplayAmountInput = {
  rawCostLi: bigint;
  rule: DisplayAmountRule;
  randomPercent?: number;
};

export type DisplayAmountResult = {
  rawCostLi: bigint;
  displayAmountLi: bigint;
  reason: 'ratio' | 'max_cap' | 'min_floor' | 'dropped';
};

export function computeDisplayAmount(
  input: DisplayAmountInput,
): DisplayAmountResult {
  const randomPercent = input.randomPercent ?? 101;
  if (
    input.rule.dropPercent !== undefined &&
    randomPercent <= input.rule.dropPercent
  ) {
    return {
      rawCostLi: input.rawCostLi,
      displayAmountLi: 0n,
      reason: 'dropped',
    };
  }

  let displayAmountLi = percentOfLi(
    input.rawCostLi,
    input.rule.ratioPercent,
  );
  let reason: DisplayAmountResult['reason'] = 'ratio';

  if (
    input.rule.maxDisplayLi !== undefined &&
    displayAmountLi > input.rule.maxDisplayLi
  ) {
    displayAmountLi = input.rule.maxDisplayLi;
    reason = 'max_cap';
  }

  if (
    input.rule.minDisplayLi !== undefined &&
    displayAmountLi > 0n &&
    displayAmountLi < input.rule.minDisplayLi
  ) {
    displayAmountLi = input.rule.minDisplayLi;
    reason = 'min_floor';
  }

  return {
    rawCostLi: input.rawCostLi,
    displayAmountLi,
    reason,
  };
}
