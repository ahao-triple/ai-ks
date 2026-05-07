import { IsNotEmpty, ValidateNested, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

// 定义嵌套的 SystemData 类
export class SystemDataDto {
  @IsNotEmpty({ message: 'env 不能为空' })
  env: string;

  @IsNotEmpty({ message: 'brand 不能为空' })
  brand: string;

  @IsNotEmpty({ message: 'model 不能为空' })
  model: string;
}

// 主 DTO 类
export class GameUserLoginDto {
  @IsNotEmpty({ message: 'app_id 不能为空' })
  app_id: string;

  @IsNotEmpty({ message: 'code 不能为空' })
  code: string;

  @IsOptional() // 标记为可选
  clickid?: string; // 使用 ? 表示可选

  @IsOptional() // 标记为可选
  @ValidateNested() // 验证嵌套对象（如果存在）
  @Type(() => SystemDataDto) // 转换为 SystemDataDto 类型
  systemData: SystemDataDto; // 使用 ? 表示可选

  ip: string;
}
