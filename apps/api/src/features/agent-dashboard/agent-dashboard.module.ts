import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { AgentModule } from '../agent/agent.module';
import { AgentDashboardController } from './agent-dashboard.controller';
import { AgentDashboardService } from './agent-dashboard.service';

@Module({
  imports: [PrismaModule, AgentModule],
  controllers: [AgentDashboardController],
  providers: [AgentDashboardService],
})
export class AgentDashboardModule {}
