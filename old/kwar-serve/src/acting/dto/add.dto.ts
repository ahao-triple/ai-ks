import { IsNotEmpty, Max, Min } from 'class-validator';

export class AddDto {
  @IsNotEmpty({ message: '代理商名字不能为空' })
  name: string;

  @IsNotEmpty({ message: '分成比例不能为空' })
  @Max(20, { message: '分成比例不能大于20%' })
  @Min(1, { message: '分成比例不能小于1%' })
  scale: number;

  @IsNotEmpty({ message: '代理支付宝登录号不能为空' })
  acting_alipay_login: string;

  @IsNotEmpty({ message: '代理支付宝名字不能为空' })
  acting_alipay_name: string;

  @IsNotEmpty({ message: '代理抽取分成方式 不能为空' }) // 0 老板 1 客户
  withdraw_type: number;

  @IsNotEmpty({ message: '代理等级 不能为空' })
  acting_level: number;

  @IsNotEmpty({ message: '一级代理不能为空' })
  acting_top_id: string; // 上级代理id  0 为顶级代理  非0 为下级代理  默认为0  可以为空  可以为null  可以为undefined  可以为ab

  @IsNotEmpty()
  nickname: string;
}
