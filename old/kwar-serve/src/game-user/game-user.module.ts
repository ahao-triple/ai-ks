import { Module } from '@nestjs/common';
import { GameUserService } from './game-user.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GameUser } from './game-user.entity';
import { GameUserController } from './game-user.controller';
import { Game } from 'src/game/game.entity';
import { HttpModule } from '@nestjs/axios';
import { EcpmModule } from 'src/ecpm/ecpm.module';
import { User } from 'src/user/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([GameUser, Game, User]),
    HttpModule,
    EcpmModule,
  ],
  providers: [GameUserService],
  controllers: [GameUserController],
  exports: [GameUserService],
})
// eslint-disable-next-line prettier/prettier
export class GameUserModule {}
