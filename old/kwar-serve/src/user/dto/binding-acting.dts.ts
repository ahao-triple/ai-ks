import { IsNotEmpty } from 'class-validator';

export class BindingActingDto {
  @IsNotEmpty({ message: '请输入邀请码' })
  acting_id: string;

  @IsNotEmpty({ message: '请登录' })
  username: string;
}
