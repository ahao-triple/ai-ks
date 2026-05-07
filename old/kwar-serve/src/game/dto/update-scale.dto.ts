import { IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class UpdateScaleDto {
  @IsString()
  app_id: string;

  @IsNumber()
  scale: number;

  @IsNotEmpty()
  nickname: string;
}
