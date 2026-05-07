import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { resolveWorkspaceEnvPath } from './common/env/workspace-env';
import { PrismaModule } from './common/prisma/prisma.module';
import { DemoModule } from './features/demo/demo.module';
import { GameSessionModule } from './features/game/game-session.module';
import { KuaishouRefreshModule } from './features/kuaishou-admin/kuaishou-refresh.module';
import { UserEarningsModule } from './features/user/user-earnings.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: resolveWorkspaceEnvPath(),
      isGlobal: true,
    }),
    PrismaModule,
    HealthModule,
    DemoModule,
    GameSessionModule,
    KuaishouRefreshModule,
    UserEarningsModule,
  ],
})
export class AppModule {}
