import { IsNotEmpty } from 'class-validator';

export class RejectWithdrawDto {
  @IsNotEmpty({ message: 'id不能为空' })
  id: number;

  @IsNotEmpty({ message: '拒绝原因不能为空' })
  remark: string;
}
