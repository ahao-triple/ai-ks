import { IsNotEmpty } from 'class-validator';

export class UpdateDto {
  @IsNotEmpty({ message: '代理id不能为空' })
  acting_id: string;

  @IsNotEmpty({ message: '代理商名字不能为空' })
  name: string;

  @IsNotEmpty({ message: '分成比例不能为空' })
  scale: number;

  @IsNotEmpty({ message: '代理支付宝登录号不能为空' })
  acting_alipay_login: string;

  @IsNotEmpty({ message: '代理支付宝名字不能为空' })
  acting_alipay_name: string;

  @IsNotEmpty({ message: '代理支付方式 不能为空' })
  withdraw_type: number;

  @IsNotEmpty({ message: '代理等级 不能为空' })
  acting_level: number;
}
