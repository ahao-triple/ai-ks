import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { shouldCheckPrismaSchemaOnBoot } from './prisma-schema-check-on-boot';
import { PrismaSchemaGuard } from './prisma-schema-guard';
import { shouldConnectPrismaOnBoot } from './prisma-connect-on-boot';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit() {
    if (shouldConnectPrismaOnBoot()) {
      await this.$connect();
    }

    if (shouldCheckPrismaSchemaOnBoot()) {
      await new PrismaSchemaGuard(this).assertSchemaReady();
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
