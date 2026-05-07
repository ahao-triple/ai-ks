import { IsNotEmpty } from 'class-validator';

export class BindingUserDto {
  @IsNotEmpty({ message: '用户名不能为空' })
  username: string;

  @IsNotEmpty({ message: '请输入Nick_ID' })
  nick_id: string;
}
