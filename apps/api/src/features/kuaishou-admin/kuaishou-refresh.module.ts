import { Module } from '@nestjs/common';
import { KuaishouModule } from '../../integrations/kuaishou/kuaishou.module';
import { DemoModule } from '../demo/demo.module';
import { KuaishouRefreshController } from './kuaishou-refresh.controller';

@Module({
  controllers: [KuaishouRefreshController],
  imports: [DemoModule, KuaishouModule],
})
export class KuaishouRefreshModule {}
