import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { AdminAuthModule } from '../admin-auth/admin-auth.module';
import { AuditLogModule } from '../audit/audit-log.module';
import { AdminResourcesController } from './admin-resources.controller';
import { AdminResourcesService } from './admin-resources.service';

@Module({
  controllers: [AdminResourcesController],
  imports: [AdminAuthModule, AuditLogModule, PrismaModule],
  providers: [AdminResourcesService],
})
export class AdminResourcesModule {}
