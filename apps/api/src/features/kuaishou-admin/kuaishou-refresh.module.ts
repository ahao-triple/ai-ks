import { Module } from '@nestjs/common';
import { KuaishouModule } from '../../integrations/kuaishou/kuaishou.module';
import { AdminAuthModule } from '../admin-auth/admin-auth.module';
import { AuditLogModule } from '../audit/audit-log.module';
import { DemoModule } from '../demo/demo.module';
import { KuaishouRefreshController } from './kuaishou-refresh.controller';
import { KuaishouTokenController } from './kuaishou-token.controller';

@Module({
  controllers: [KuaishouRefreshController, KuaishouTokenController],
  imports: [AdminAuthModule, AuditLogModule, DemoModule, KuaishouModule],
})
export class KuaishouRefreshModule {}
