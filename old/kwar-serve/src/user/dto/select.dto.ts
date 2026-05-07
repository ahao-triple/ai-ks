import { IsNotEmpty, IsOptional } from 'class-validator';

export class SelectDto {
  @IsNotEmpty({ message: '页数不能为空' })
  page: number;

  @IsNotEmpty({ message: '每页数量不能为空' })
  pageSize: number;

  /**
   * 条件查询
   * 游戏用户id
   * 用户号码
   * 代理邀请码
   * 支付宝名字
   * 支付宝账号
   */
  @IsOptional()
  game_users: string;

  @IsOptional()
  nickname: string;

  @IsOptional()
  acting_id: string;

  @IsOptional()
  withdraw_name: string;

  @IsOptional()
  withdraw_alipay: string;
}
