import { computeSettlementSplit } from './settlement-split';

describe('computeSettlementSplit', () => {
  const rule = {
    defaultAgentRatioPercent: 5,
    directAgentRatioPercent: 10,
    feeRatioPercent: 5,
    parentAgentRatioPercent: 10,
    userRatioPercent: 70,
  };

  it('splits display amount by the platform settlement rule', () => {
    expect(
      computeSettlementSplit({
        displayAmountLi: 10000n,
        rule,
      }),
    ).toEqual({
      defaultAgentAmountLi: 500n,
      directAgentAmountLi: 1000n,
      feeAmountLi: 500n,
      parentAgentAmountLi: 1000n,
      totalAmountLi: 10000n,
      userAmountLi: 7000n,
    });
  });

  it('keeps rounding residue in the fee bucket so the split total is stable', () => {
    expect(
      computeSettlementSplit({
        displayAmountLi: 1n,
        rule: {
          defaultAgentRatioPercent: 0,
          directAgentRatioPercent: 33,
          feeRatioPercent: 1,
          parentAgentRatioPercent: 33,
          userRatioPercent: 33,
        },
      }),
    ).toEqual({
      defaultAgentAmountLi: 0n,
      directAgentAmountLi: 0n,
      feeAmountLi: 1n,
      parentAgentAmountLi: 0n,
      totalAmountLi: 1n,
      userAmountLi: 0n,
    });
  });
});
