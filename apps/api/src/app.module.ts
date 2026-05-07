import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { resolveWorkspaceEnvPath } from './common/env/workspace-env';
import { PrismaModule } from './common/prisma/prisma.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: resolveWorkspaceEnvPath(),
      isGlobal: true,
    }),
    PrismaModule,
    HealthModule,
  ],
})
export class AppModule {}
