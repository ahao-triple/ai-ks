import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

// 所有查询都是按时间排序
export class FindEcpmDto {
  @IsNotEmpty({ message: 'username 不能为空' })
  username: string;

  @IsNotEmpty({ message: '页码不能为空' })
  page: number;

  @IsNotEmpty({ message: '每页数量不能为空' })
  page_size: number;

  @IsNotEmpty({ message: '开始时间不能为空' })
  start_time: string;

  @IsNotEmpty({ message: '开始时间不能为空' })
  end_time: string;

  @IsNotEmpty({ message: 'app_id 不能为空' })
  app_id: string;

  @IsString()
  @IsOptional()
  nick_id: string;
}
