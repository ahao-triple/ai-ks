import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { AdminAuthModule } from '../admin-auth/admin-auth.module';
import { SettlementAdminController } from './settlement-admin.controller';
import { SettlementAdminService } from './settlement-admin.service';

@Module({
  controllers: [SettlementAdminController],
  imports: [AdminAuthModule, PrismaModule],
  providers: [SettlementAdminService],
})
export class SettlementAdminModule {}
