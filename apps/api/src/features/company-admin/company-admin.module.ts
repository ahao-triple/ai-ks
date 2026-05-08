import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { AdminAuthModule } from '../admin-auth/admin-auth.module';
import { CompanyAdminController } from './company-admin.controller';
import { CompanyAdminService } from './company-admin.service';

@Module({
  controllers: [CompanyAdminController],
  exports: [CompanyAdminService],
  imports: [AdminAuthModule, PrismaModule],
  providers: [CompanyAdminService],
})
export class CompanyAdminModule {}
