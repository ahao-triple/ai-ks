import { IsNotEmpty } from 'class-validator';

export class IdentityUserDto {
  @IsNotEmpty({ message: '用户id不能为空' })
  id: string;

  @IsNotEmpty({ message: '用户身份不能为空' })
  identity: string;

  @IsNotEmpty()
  nickname: string;
}
