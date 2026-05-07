import {
  IsNotEmpty,
  IsString,
  MaxLength,
  IsNumber,
  IsOptional,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

// 嵌套的 config 类
export class GameConfigDto {
  @IsNumber({}, { message: 'ecpm 必须是数字' })
  ecpm: number;

  @IsNumber({}, { message: 'ipu 必须是数字' })
  ipu: number;
}

export class GameLimitDto {
  @IsNumber({}, { message: 'video_max: 必须是数字' })
  video_max: number;

  @IsNotEmpty({ message: 'video_id 不能为空' })
  video_id: string;
}

export class CreateGameDto {
  @IsNotEmpty({ message: 'app_id 不能为空' })
  @IsString({ message: 'app_id 必须是字符串' })
  app_id: string;

  @IsNotEmpty({ message: 'name 不能为空' })
  @IsString({ message: 'name 必须是字符串' })
  @MaxLength(100, { message: 'name 长度不能超过 100 个字符' })
  name: string;

  @IsNotEmpty({ message: 'secret 不能为空' })
  @IsString({ message: 'secret 必须是字符串' })
  secret: string;

  @IsOptional()
  @ValidateNested({ message: 'config 格式不正确' })
  @Type(() => GameConfigDto) // 配合 class-transformer 将对象转换为 GameConfigDto 类型
  config?: GameConfigDto;

  @IsOptional()
  @ValidateNested({ message: 'limit 格式不正确' })
  @Type(() => GameLimitDto) // 配合 class-transformer 将对象转换为 GameConfigDto 类型
  limit?: GameLimitDto;

  @IsNotEmpty()
  @IsString()
  nickname: string;
}
