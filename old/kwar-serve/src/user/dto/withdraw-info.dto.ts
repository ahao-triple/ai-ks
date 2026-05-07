import { IsNotEmpty } from 'class-validator';
export class WithdrawInfoDto {
  @IsNotEmpty({ message: '用户昵称不能为空' })
  nickname: string;

  @IsNotEmpty({ message: '支付宝账号不能为空' })
  alipay: string;

  @IsNotEmpty({ message: '真实姓名不能为空' })
  name: string;
}
