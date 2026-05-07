import { IsBoolean, IsNotEmpty, IsString } from 'class-validator';

export class UpdateIsWithdrawDto {
  @IsNotEmpty({ message: 'is_withdraw 不能为空' })
  @IsBoolean()
  isWithdraw: boolean;

  @IsNotEmpty({ message: 'app_id 不能为空' })
  @IsString()
  app_id: string;

  @IsNotEmpty()
  nickname: string;
}
