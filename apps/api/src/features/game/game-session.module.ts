import { Module } from '@nestjs/common';
import { KuaishouModule } from '../../integrations/kuaishou/kuaishou.module';
import { DemoModule } from '../demo/demo.module';
import { GameSessionController } from './game-session.controller';
import { GameSessionService } from './game-session.service';

@Module({
  controllers: [GameSessionController],
  imports: [DemoModule, KuaishouModule],
  providers: [GameSessionService],
})
export class GameSessionModule {}
