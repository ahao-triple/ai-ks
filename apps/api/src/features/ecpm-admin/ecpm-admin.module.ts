import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { KuaishouModule } from '../../integrations/kuaishou/kuaishou.module';
import { AdminAuthModule } from '../admin-auth/admin-auth.module';
import { AuditLogModule } from '../audit/audit-log.module';
import { DemoModule } from '../demo/demo.module';
import { KuaishouEcpmRangeSyncService } from '../kuaishou-admin/kuaishou-ecpm-range-sync.service';
import { KuaishouEcpmSyncJobService } from '../kuaishou-admin/kuaishou-ecpm-sync-job.service';
import { EcpmAdminController } from './ecpm-admin.controller';
import { EcpmDashboardService } from './ecpm-dashboard.service';
import { EcpmUpdateJobService } from './ecpm-update-job.service';
import { EcpmUpdateRangeService } from './ecpm-update-range.service';

@Module({
  controllers: [EcpmAdminController],
  imports: [
    AdminAuthModule,
    AuditLogModule,
    DemoModule,
    KuaishouModule,
    PrismaModule,
  ],
  providers: [
    EcpmDashboardService,
    EcpmUpdateJobService,
    EcpmUpdateRangeService,
    KuaishouEcpmRangeSyncService,
    KuaishouEcpmSyncJobService,
  ],
})
export class EcpmAdminModule {}
