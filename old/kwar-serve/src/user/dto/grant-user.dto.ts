import { IsNotEmpty } from 'class-validator';

export class GrantUserDto {
  @IsNotEmpty({ message: '用户名不能为空' })
  username: string;
}
