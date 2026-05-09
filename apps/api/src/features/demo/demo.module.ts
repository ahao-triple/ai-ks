import { Module } from '@nestjs/common';
import { PlatformConfigModule } from '../platform-config/platform-config.module';
import { DemoController } from './demo.controller';
import { DemoStore } from './demo-store';

@Module({
  controllers: [DemoController],
  exports: [DemoStore],
  imports: [PlatformConfigModule],
  providers: [DemoStore],
})
export class DemoModule {}
