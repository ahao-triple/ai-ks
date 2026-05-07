import { IsNotEmpty } from 'class-validator';

export class createEcpm {
  @IsNotEmpty({ message: 'app_id 不能为空' })
  app_id: string;

  @IsNotEmpty({ message: '时间不能为空' })
  data_hour: string;

  open_id: string;
}
