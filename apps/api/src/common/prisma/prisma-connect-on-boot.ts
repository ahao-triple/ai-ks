export function shouldConnectPrismaOnBoot(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env.PRISMA_CONNECT_ON_BOOT === 'true';
}
