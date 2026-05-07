import { IsNotEmpty } from 'class-validator';

export class DeleteGameDto {
  @IsNotEmpty({ message: 'app_id 不能为空' })
  app_id: string;

  @IsNotEmpty({ message: 'ecpm_id 不能为空' })
  date: string;
}
