import { Module } from '@nestjs/common';
import { WithdrawController } from './withdraw.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WithdrawEntity } from './withdraw.entity';
import { User } from 'src/user/user.entity';
import { WithdrawService } from './withdraw.service';
import { AlipayModule } from 'src/alipay/alipay.module';
import { Acting } from 'src/acting/acting.entity';
import { Company } from 'src/company/company.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, WithdrawEntity, Acting, Company]),
    AlipayModule,
  ],
  providers: [WithdrawService],
  controllers: [WithdrawController],
  exports: [WithdrawService],
})
export class WithdrawModule {}
