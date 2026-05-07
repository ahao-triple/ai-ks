import { IsNotEmpty, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsNotEmpty({ message: '用户名不能为空' })
  username: string;

  @MinLength(6, { message: '密码至少需要6个字符' })
  password: string;

  @IsNotEmpty({ message: '邀请码不能为空' })
  acting_id: string;
}
