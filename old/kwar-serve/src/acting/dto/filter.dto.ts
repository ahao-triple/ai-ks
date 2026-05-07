import { IsNotEmpty } from 'class-validator';

export class FilterDto {
  @IsNotEmpty({ message: '邀请码不能为空' })
  acting_id: string;
}
