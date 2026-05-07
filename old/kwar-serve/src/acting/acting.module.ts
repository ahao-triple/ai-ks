import { Module } from '@nestjs/common';
import { ActingController } from './acting.controller';
import { ActingService } from './acting.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Acting } from './acting.entity';
import { User } from 'src/user/user.entity';
import { Ecpm } from 'src/ecpm/ecpm.entity';
import { UserModule } from 'src/user/user.module';

@Module({
  imports: [TypeOrmModule.forFeature([Acting, User, Ecpm]), UserModule],
  controllers: [ActingController],
  providers: [ActingService],
  exports: [ActingService],
})
export class ActingModule {}
