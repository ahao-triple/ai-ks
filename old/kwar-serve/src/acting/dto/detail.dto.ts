import { IsNotEmpty } from 'class-validator';

export class DetailDto {
  @IsNotEmpty({ message: 'acting_id不能为空' })
  acting_id: string;

  @IsNotEmpty({ message: '开始时间不能为空' })
  start_time: string;

  @IsNotEmpty({ message: '结束时间不能为空' })
  end_time: string;
}
