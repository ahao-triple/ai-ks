import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { AdminAuthModule } from '../admin-auth/admin-auth.module';
import { BusinessClosureController } from './business-closure.controller';
import { BusinessClosureService } from './business-closure.service';

@Module({
  controllers: [BusinessClosureController],
  imports: [AdminAuthModule, PrismaModule],
  providers: [BusinessClosureService],
})
export class BusinessClosureModule {}
