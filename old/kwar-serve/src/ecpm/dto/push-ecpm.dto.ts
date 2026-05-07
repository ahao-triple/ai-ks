import { IsNotEmpty, IsNumber, IsPositive, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class PushEcpmDto {
  @IsNotEmpty({ message: '时间不能为空(yyyy-MM-dd)' })
  date: string; // yyyy-mm-dd

  @IsNotEmpty({ message: '最小金额不能为空(单位元)' })
  @Type(() => Number)
  @IsNumber({}, { message: '最小金额必须为数字' })
  @IsPositive({ message: '最小金额必须为正数' })
  min: number;

  @IsNotEmpty({ message: '最大金额不能为空(单位元)' })
  @Type(() => Number)
  @IsNumber({}, { message: '最大金额必须为数字' })
  @IsPositive({ message: '最大金额必须为正数' })
  @Min(1, { message: '最大金额必须大于0' })
  max: number;

  @IsNotEmpty({ message: 'nick_id 不能为空' })
  nick_id: string;

  @IsNotEmpty({ message: 'app_id 不能为空' })
  app_id: string;
}
