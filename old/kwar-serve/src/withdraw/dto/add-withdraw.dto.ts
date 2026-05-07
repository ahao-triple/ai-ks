import { IsNotEmpty, MinLength } from 'class-validator';

export class AddWithdrawDto {
  @MinLength(11, { message: '手机号码格式不正确' })
  nickname: string;

  @IsNotEmpty({ message: '金额不能为空' })
  amount: number;

  @IsNotEmpty({ message: '姓名不能为空' })
  name: string;

  @IsNotEmpty({ message: '支付宝账号不能为空' })
  alipay: string;

  @IsNotEmpty({ message: '备注不能为空' })
  remark: string;
}
