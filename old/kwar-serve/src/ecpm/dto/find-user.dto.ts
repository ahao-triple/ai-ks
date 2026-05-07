import { IsNotEmpty } from 'class-validator';

export class FindByUserDto {
  @IsNotEmpty({ message: 'open_id 不能为空' })
  open_id: string;

  @IsNotEmpty({ message: '页码不能为空' })
  page: number;

  @IsNotEmpty({ message: '每页数量不能为空' })
  page_size: number;

  @IsNotEmpty({ message: '开始时间不能为空' })
  start_time: Date;

  @IsNotEmpty({ message: '开始时间不能为空' })
  end_time: Date;
}
