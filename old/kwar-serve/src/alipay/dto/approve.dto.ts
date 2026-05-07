import { IsNotEmpty } from 'class-validator';

export class ApproveDto {
  // 提现 id
  @IsNotEmpty({ message: '提现 id 不能为空' })
  id: string;

  @IsNotEmpty({ message: '提现金额不能为空' })
  amount: number;

  @IsNotEmpty({ message: '支付宝账号不能为空' })
  alipay: string;

  @IsNotEmpty({ message: '支付宝姓名不能为空' })
  name: string;
}
