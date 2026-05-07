import { Module } from '@nestjs/common';
import { DemoModule } from '../demo/demo.module';
import { UserEarningsController } from './user-earnings.controller';

@Module({
  controllers: [UserEarningsController],
  imports: [DemoModule],
})
export class UserEarningsModule {}
