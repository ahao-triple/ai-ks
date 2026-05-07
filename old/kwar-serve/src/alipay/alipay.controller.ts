/* eslint-disable @typescript-eslint/no-unsafe-return */
import { Controller, Get } from '@nestjs/common';
import { AlipayService } from './alipay.serveice';

@Controller('alipay')
export class AlipayController {
  constructor(private readonly alipayService: AlipayService) {}

  @Get('test')
  async testAlipay() {
    return await this.alipayService.testAlipay();
  }

  @Get('quota')
  async getQuota() {
    return await this.alipayService.getQuota();
  }

  // @Post('approve')
  // async approveWithdraw(@Body() dto: ApproveDto) {
  // return await this.alipayService.approveWithdraw(dto);
  // }

  @Get('downUrl')
  async getDownUrl() {
    return await this.alipayService.getDownUrl();
  }
}
