import { Module } from '@nestjs/common';
import { AlipayController } from './alipay.controller';
import { AlipayService } from './alipay.serveice';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [HttpModule],
  providers: [AlipayService],
  controllers: [AlipayController],
  exports: [AlipayService],
})
export class AlipayModule {}
