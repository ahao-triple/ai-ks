import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { PlatformConfigModule } from '../platform-config/platform-config.module';
import { GameDataStore } from './game-data.store';

@Module({
  exports: [GameDataStore],
  imports: [PlatformConfigModule, PrismaModule],
  providers: [GameDataStore],
})
export class GameDataModule {}
