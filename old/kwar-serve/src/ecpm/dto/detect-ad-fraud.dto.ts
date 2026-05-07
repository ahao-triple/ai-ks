import { IsOptional, IsString, IsBoolean } from 'class-validator';

export class DetectAdFraudDto {
  @IsOptional()
  readonly minIntervalSeconds: number = 8;

  @IsOptional()
  readonly maxAllowedCount: number = 8;

  @IsOptional()
  @IsString()
  readonly app_id?: string;

  @IsOptional()
  @IsBoolean()
  readonly dryRun?: boolean = false;
}
