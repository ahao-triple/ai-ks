import { Module } from '@nestjs/common';
import { KuaishouModule } from '../../integrations/kuaishou/kuaishou.module';
import { AdminAuthModule } from '../admin-auth/admin-auth.module';
import { DemoModule } from '../demo/demo.module';
import { KuaishouRefreshController } from './kuaishou-refresh.controller';

@Module({
  controllers: [KuaishouRefreshController],
  imports: [AdminAuthModule, DemoModule, KuaishouModule],
})
export class KuaishouRefreshModule {}
