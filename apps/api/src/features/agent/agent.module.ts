import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PlatformConfigModule } from '../platform-config/platform-config.module';
import { AgentAuthService } from './agent-auth.service';
import { AgentController } from './agent.controller';
import { AgentJwtGuard } from './agent-jwt.guard';
import { AgentPortalService } from './agent-portal.service';

@Module({
  controllers: [AgentController],
  exports: [AgentAuthService, AgentPortalService],
  imports: [JwtModule.register({}), PlatformConfigModule],
  providers: [AgentAuthService, AgentJwtGuard, AgentPortalService],
})
export class AgentModule {}
