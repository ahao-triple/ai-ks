import { IsNotEmpty } from 'class-validator';

export class updateToken {
  @IsNotEmpty({ message: 'app_id 不能为空' })
  app_id: string;
}
