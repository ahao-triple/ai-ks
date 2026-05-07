import { Module } from '@nestjs/common';
import { EcpmController } from './ecpm.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Ecpm } from './ecpm.entity';
import { HttpModule } from '@nestjs/axios';
import { EcpmService } from './ecpm.service';
import { CompanyModule } from 'src/company/company.module';
import { Company } from 'src/company/company.entity';
import { User } from 'src/user/user.entity';
import { Game } from 'src/game/game.entity';
import { GameUser } from 'src/game-user/game-user.entity';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    TypeOrmModule.forFeature([Ecpm, Company, User, Game, GameUser]),
    HttpModule,
    CompanyModule,
    ScheduleModule.forRoot(),
  ],
  providers: [EcpmService],
  controllers: [EcpmController],
  exports: [EcpmService],
})
// eslint-disable-next-line prettier/prettier
export class EcpmModule {}
