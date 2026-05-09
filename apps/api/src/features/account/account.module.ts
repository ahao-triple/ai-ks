import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuditLogModule } from '../audit/audit-log.module';
import { PlatformConfigModule } from '../platform-config/platform-config.module';
import { AccountAuthService } from './account-auth.service';
import { AccountController } from './account.controller';
import { AccountJwtGuard } from './account-jwt.guard';
import { AccountService } from './account.service';
import { AccountWalletService } from './account-wallet.service';

@Module({
  imports: [AuditLogModule, JwtModule.register({}), PlatformConfigModule],
  controllers: [AccountController],
  exports: [
    AccountAuthService,
    AccountService,
    AccountWalletService,
  ],
  providers: [
    AccountAuthService,
    AccountJwtGuard,
    AccountService,
    AccountWalletService,
  ],
})
export class AccountModule {}
