import { shouldConnectPrismaOnBoot } from './prisma-connect-on-boot';

describe('shouldConnectPrismaOnBoot', () => {
  it('defaults to lazy prisma connection so local dev can start without database access', () => {
    expect(shouldConnectPrismaOnBoot({})).toBe(false);
  });

  it('connects on boot only when explicitly enabled', () => {
    expect(
      shouldConnectPrismaOnBoot({
        PRISMA_CONNECT_ON_BOOT: 'true',
      }),
    ).toBe(true);
  });
});
