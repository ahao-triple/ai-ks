import { IsNotEmpty } from 'class-validator';

export class updateProDto {
  @IsNotEmpty({ message: '比例不能为空' })
  pro: number;
}
