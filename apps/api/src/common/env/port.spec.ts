import { resolveConfiguredPort } from './port';

describe('resolveConfiguredPort', () => {
  it('uses the named env port before the default value', () => {
    expect(
      resolveConfiguredPort({
        defaultPort: 3000,
        env: {
          API_PORT: '3100',
        },
        name: 'API_PORT',
      }),
    ).toBe(3100);
  });

  it('falls back to the default port when env is not configured', () => {
    expect(
      resolveConfiguredPort({
        defaultPort: 3000,
        env: {},
        name: 'API_PORT',
      }),
    ).toBe(3000);
  });

  it('rejects invalid port values with the env name', () => {
    expect(() =>
      resolveConfiguredPort({
        defaultPort: 3000,
        env: {
          API_PORT: 'abc',
        },
        name: 'API_PORT',
      }),
    ).toThrow('API_PORT must be a valid port number');
  });
});
