export function shouldCheckPrismaSchemaOnBoot(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env.PRISMA_SCHEMA_CHECK_ON_BOOT !== 'false';
}
