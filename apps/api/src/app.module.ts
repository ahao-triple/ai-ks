import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { resolveWorkspaceEnvPath } from './common/env/workspace-env';
import { PrismaModule } from './common/prisma/prisma.module';
import { AdminAuthModule } from './features/admin-auth/admin-auth.module';
import { AccountModule } from './features/account/account.module';
import { AuditLogModule } from './features/audit/audit-log.module';
import { DemoModule } from './features/demo/demo.module';
import { GameSessionModule } from './features/game/game-session.module';
import { KuaishouRefreshModule } from './features/kuaishou-admin/kuaishou-refresh.module';
import { UserEarningsModule } from './features/user/user-earnings.module';
import { WithdrawalReviewModule } from './features/withdrawal-admin/withdrawal-review.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: resolveWorkspaceEnvPath(),
      isGlobal: true,
    }),
    PrismaModule,
    HealthModule,
    AdminAuthModule,
    AuditLogModule,
    AccountModule,
    DemoModule,
    GameSessionModule,
    KuaishouRefreshModule,
    WithdrawalReviewModule,
    UserEarningsModule,
  ],
})
export class AppModule {}
