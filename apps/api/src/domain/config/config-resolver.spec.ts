import { resolveConfigValue } from './config-resolver';

describe('resolveConfigValue', () => {
  it('uses agent plus game override before game and agent overrides', () => {
    const value = resolveConfigValue({
      globalDefault: 50,
      agentDefault: 55,
      gameDefault: 60,
      agentGameOverride: 65,
    });

    expect(value).toBe(65);
  });

  it('uses game override before agent override', () => {
    const value = resolveConfigValue({
      globalDefault: 50,
      agentDefault: 55,
      gameDefault: 60,
    });

    expect(value).toBe(60);
  });

  it('falls back to global default when no overrides are present', () => {
    expect(resolveConfigValue({ globalDefault: 3 })).toBe(3);
  });
});
