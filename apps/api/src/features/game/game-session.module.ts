import { Module } from '@nestjs/common';
import { KuaishouModule } from '../../integrations/kuaishou/kuaishou.module';
import { GameDataModule } from '../game-data/game-data.module';
import { GameSessionController } from './game-session.controller';
import { GameSessionService } from './game-session.service';

@Module({
  controllers: [GameSessionController],
  imports: [GameDataModule, KuaishouModule],
  providers: [GameSessionService],
})
export class GameSessionModule {}
