import { IsNotEmpty } from 'class-validator';

export class CreateTokenDto {
  @IsNotEmpty({ message: 'auth_code 不能为空' })
  auth_code: string;
}
