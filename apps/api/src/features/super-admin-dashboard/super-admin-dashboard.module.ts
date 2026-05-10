import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { AdminAuthModule } from '../admin-auth/admin-auth.module';
import { UserDashboardModule } from '../user-dashboard/user-dashboard.module';
import { SuperAdminDashboardController } from './super-admin-dashboard.controller';
import { SuperAdminDashboardService } from './super-admin-dashboard.service';

@Module({
  imports: [PrismaModule, AdminAuthModule, UserDashboardModule],
  controllers: [SuperAdminDashboardController],
  providers: [SuperAdminDashboardService],
})
export class SuperAdminDashboardModule {}
