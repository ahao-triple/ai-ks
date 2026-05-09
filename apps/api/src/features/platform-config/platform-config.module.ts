import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { AdminAuthModule } from '../admin-auth/admin-auth.module';
import { PlatformConfigController } from './platform-config.controller';
import { PlatformConfigService } from './platform-config.service';

@Module({
  controllers: [PlatformConfigController],
  exports: [PlatformConfigService],
  imports: [AdminAuthModule, PrismaModule],
  providers: [PlatformConfigService],
})
export class PlatformConfigModule {}
