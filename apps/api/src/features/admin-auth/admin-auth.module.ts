import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { AdminAccessControlService } from './admin-access-control.service';
import { AdminAuthController } from './admin-auth.controller';
import { AdminAuthService } from './admin-auth.service';
import { AdminJwtGuard } from './admin-jwt.guard';
import { SuperAdminGuard } from './super-admin.guard';

@Module({
  controllers: [AdminAuthController],
  exports: [
    AdminAccessControlService,
    AdminAuthService,
    AdminJwtGuard,
    SuperAdminGuard,
  ],
  imports: [JwtModule.register({}), PrismaModule],
  providers: [
    AdminAccessControlService,
    AdminAuthService,
    AdminJwtGuard,
    SuperAdminGuard,
  ],
})
export class AdminAuthModule {}
