import { PrismaSchemaGuard } from './prisma-schema-guard';
import { PrismaService } from './prisma.service';

describe('PrismaService', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.restoreAllMocks();
    process.env = { ...originalEnv };
    delete process.env.PRISMA_CONNECT_ON_BOOT;
    delete process.env.PRISMA_SCHEMA_CHECK_ON_BOOT;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('checks schema on module init by default', async () => {
    const service = new PrismaService();
    const connectSpy = jest
      .spyOn(service, '$connect')
      .mockResolvedValue(undefined);
    const schemaSpy = jest
      .spyOn(PrismaSchemaGuard.prototype, 'assertSchemaReady')
      .mockResolvedValue(undefined);

    await service.onModuleInit();

    expect(connectSpy).not.toHaveBeenCalled();
    expect(schemaSpy).toHaveBeenCalledTimes(1);
  });

  it('skips schema check when disabled', async () => {
    process.env.PRISMA_SCHEMA_CHECK_ON_BOOT = 'false';
    const service = new PrismaService();
    const schemaSpy = jest
      .spyOn(PrismaSchemaGuard.prototype, 'assertSchemaReady')
      .mockResolvedValue(undefined);

    await service.onModuleInit();

    expect(schemaSpy).not.toHaveBeenCalled();
  });

  it('connects before checking schema when eager connection is enabled', async () => {
    process.env.PRISMA_CONNECT_ON_BOOT = 'true';
    const service = new PrismaService();
    const connectSpy = jest
      .spyOn(service, '$connect')
      .mockResolvedValue(undefined);
    const schemaSpy = jest
      .spyOn(PrismaSchemaGuard.prototype, 'assertSchemaReady')
      .mockResolvedValue(undefined);

    await service.onModuleInit();

    expect(connectSpy).toHaveBeenCalledTimes(1);
    expect(schemaSpy).toHaveBeenCalledTimes(1);
    expect(connectSpy.mock.invocationCallOrder[0]).toBeLessThan(
      schemaSpy.mock.invocationCallOrder[0],
    );
  });

  it('propagates schema check errors so API startup fails', async () => {
    const service = new PrismaService();
    jest
      .spyOn(PrismaSchemaGuard.prototype, 'assertSchemaReady')
      .mockRejectedValue(new Error('schema mismatch'));

    await expect(service.onModuleInit()).rejects.toThrow('schema mismatch');
  });
});
