import { Module, forwardRef } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './user.entity';
import { GameUser } from 'src/game-user/game-user.entity';
import { WithdrawModule } from 'src/withdraw/withdraw.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, GameUser]),
    forwardRef(() => WithdrawModule),
  ],
  providers: [UserService],
  controllers: [UserController],
  exports: [UserService],
})
export class UserModule {}
