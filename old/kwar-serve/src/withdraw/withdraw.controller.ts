import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { WithdrawService } from './withdraw.service';
import { AddWithdrawDto } from './dto/add-withdraw.dto';
import { RejectWithdrawDto } from './dto/reject-withdraw.dto';

@Controller('withdraw')
export class WithdrawController {
  constructor(private readonly withdrawService: WithdrawService) {}

  // 根据 ID 获取提现列表
  @Get()
  async list(@Query('nickname') nickname: string) {
    return await this.withdrawService.getWithdrawList(nickname);
  }

  // 新增提现记录
  @Post()
  async add(@Body() addWithdrawDto: AddWithdrawDto) {
    return await this.withdrawService.addWithdraw(addWithdrawDto);
  }

  /*
   * 获取所有提现记录 根据状态返回
   * @param status 提现状态
   */
  @Get('all')
  async all(@Query('status') status: number) {
    return await this.withdrawService.getAllWithdraw(status);
  }

  @Post('withdrawal')
  async withdrawal(@Body() param: any) {
    return await this.withdrawService.withdrawal(param);
  }

  // 系统内部审核提现
  @Post('approve')
  async approve(@Body('ids') ids: number[]) {
    return await this.withdrawService.approve(ids);
  }

  /**
   * 拒绝提现
   */
  @Post('reject')
  async withdrawReject(@Body() rejectDto: RejectWithdrawDto) {
    return await this.withdrawService.withdrawReject(rejectDto);
  }

  @Post('rollback')
  async rollback(@Body('id') id: number) {
    return await this.withdrawService.rollback(id);
  }
}
