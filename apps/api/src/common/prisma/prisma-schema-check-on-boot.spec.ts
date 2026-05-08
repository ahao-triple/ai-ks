import { shouldCheckPrismaSchemaOnBoot } from './prisma-schema-check-on-boot';

describe('shouldCheckPrismaSchemaOnBoot', () => {
  it('checks schema on boot by default', () => {
    expect(shouldCheckPrismaSchemaOnBoot({})).toBe(true);
  });

  it('skips schema check only when explicitly disabled', () => {
    expect(
      shouldCheckPrismaSchemaOnBoot({
        PRISMA_SCHEMA_CHECK_ON_BOOT: 'false',
      }),
    ).toBe(false);
  });

  it('keeps schema check enabled for other values', () => {
    expect(
      shouldCheckPrismaSchemaOnBoot({
        PRISMA_SCHEMA_CHECK_ON_BOOT: 'true',
      }),
    ).toBe(true);
    expect(
      shouldCheckPrismaSchemaOnBoot({
        PRISMA_SCHEMA_CHECK_ON_BOOT: 'FALSE',
      }),
    ).toBe(true);
    expect(
      shouldCheckPrismaSchemaOnBoot({
        PRISMA_SCHEMA_CHECK_ON_BOOT: '',
      }),
    ).toBe(true);
  });
});
