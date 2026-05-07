import { IsNotEmpty } from 'class-validator';

export class CreateCompanyDto {
  callback: string;

  @IsNotEmpty({ message: 'app_id 不能为空' })
  app_id: string;

  @IsNotEmpty({ message: 'auth_code 不能为空' })
  auth_code: string;

  @IsNotEmpty({ message: ' 公司名称不能为空' })
  name: string;

  @IsNotEmpty({ message: 'secret 不能为空 ' })
  secret: string;

  @IsNotEmpty({ message: ' advertiser_id 不能为空' })
  advertiser_id: string;
}
