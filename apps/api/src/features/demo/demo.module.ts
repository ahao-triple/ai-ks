import { Module } from '@nestjs/common';
import { DemoController } from './demo.controller';
import { DemoStore } from './demo-store';

@Module({
  controllers: [DemoController],
  exports: [DemoStore],
  providers: [DemoStore],
})
export class DemoModule {}
