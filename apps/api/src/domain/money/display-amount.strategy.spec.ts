import { liToYuan, percentOfLi, yuanToLi } from './amount';
import { computeDisplayAmount } from './display-amount.strategy';

describe('amount helpers', () => {
  it('converts yuan to li and back using integer storage', () => {
    expect(yuanToLi('1.23')).toBe(1230n);
    expect(liToYuan(1230n)).toBe('1.23');
  });

  it('calculates percentages without floating point drift', () => {
    expect(percentOfLi(999n, 50)).toBe(500n);
    expect(percentOfLi(1001n, 50)).toBe(501n);
  });
});

describe('computeDisplayAmount', () => {
  it('uses the default 50 percent display ratio', () => {
    const result = computeDisplayAmount({
      rawCostLi: 10000n,
      rule: {
        ratioPercent: 50,
      },
    });

    expect(result.displayAmountLi).toBe(5000n);
    expect(result.reason).toBe('ratio');
  });

  it('caps the displayed amount when maxDisplayLi is configured', () => {
    const result = computeDisplayAmount({
      rawCostLi: 100000n,
      rule: {
        ratioPercent: 80,
        maxDisplayLi: 30000n,
      },
    });

    expect(result.displayAmountLi).toBe(30000n);
    expect(result.reason).toBe('max_cap');
  });

  it('returns zero when the deterministic drop decision is enabled', () => {
    const result = computeDisplayAmount({
      rawCostLi: 10000n,
      rule: {
        ratioPercent: 50,
        dropPercent: 100,
      },
      randomPercent: 1,
    });

    expect(result.displayAmountLi).toBe(0n);
    expect(result.reason).toBe('dropped');
  });
});
