import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { resolveWorkspaceEnvPath } from './common/env/workspace-env';
import { PrismaModule } from './common/prisma/prisma.module';
import { RateLimitModule } from './common/rate-limit/rate-limit.module';
import { AdminAuthModule } from './features/admin-auth/admin-auth.module';
import { AdminResourcesModule } from './features/admin-resources/admin-resources.module';
import { AccountModule } from './features/account/account.module';
import { AgentModule } from './features/agent/agent.module';
import { AuditLogModule } from './features/audit/audit-log.module';
import { BusinessClosureModule } from './features/business-closure/business-closure.module';
import { CompanyAdminModule } from './features/company-admin/company-admin.module';
import { EcpmAdminModule } from './features/ecpm-admin/ecpm-admin.module';
import { GameSessionModule } from './features/game/game-session.module';
import { KuaishouRefreshModule } from './features/kuaishou-admin/kuaishou-refresh.module';
import { PlatformConfigModule } from './features/platform-config/platform-config.module';
import { SettlementAdminModule } from './features/settlement-admin/settlement-admin.module';
import { UserDashboardModule } from './features/user-dashboard/user-dashboard.module';
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
    RateLimitModule,
    HealthModule,
    AdminAuthModule,
    AdminResourcesModule,
    CompanyAdminModule,
    AuditLogModule,
    AccountModule,
    AgentModule,
    BusinessClosureModule,
    EcpmAdminModule,
    GameSessionModule,
    KuaishouRefreshModule,
    PlatformConfigModule,
    SettlementAdminModule,
    WithdrawalReviewModule,
    UserDashboardModule,
    UserEarningsModule,
  ],
})
export class AppModule {}
