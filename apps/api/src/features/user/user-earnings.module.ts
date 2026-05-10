import { Module } from '@nestjs/common';
import { GameDataModule } from '../game-data/game-data.module';
import { UserEarningsController } from './user-earnings.controller';

@Module({
  controllers: [UserEarningsController],
  imports: [GameDataModule],
})
export class UserEarningsModule {}
