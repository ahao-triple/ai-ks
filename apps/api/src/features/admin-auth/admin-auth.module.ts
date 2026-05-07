import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AdminAuthController } from './admin-auth.controller';
import { AdminAuthService } from './admin-auth.service';
import { AdminJwtGuard } from './admin-jwt.guard';

@Module({
  controllers: [AdminAuthController],
  exports: [AdminAuthService, AdminJwtGuard],
  imports: [JwtModule.register({})],
  providers: [AdminAuthService, AdminJwtGuard],
})
export class AdminAuthModule {}
