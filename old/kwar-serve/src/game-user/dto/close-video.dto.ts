import { IsNotEmpty } from 'class-validator';

export class CloseVideoDto {
  @IsNotEmpty({ message: 'open_id 不能为空' })
  open_id: string;

  @IsNotEmpty({ message: 'app_id 不能为空' })
  app_id: string;
}
