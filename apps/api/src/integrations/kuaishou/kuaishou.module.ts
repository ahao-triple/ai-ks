import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { KuaishouTokenService } from '../../features/kuaishou-admin/kuaishou-token.service';
import { KuaishouEcpmClient } from './kuaishou-ecpm.client';
import { KuaishouGameAuthClient } from './kuaishou-game-auth.client';
import { KuaishouOAuthClient } from './kuaishou-oauth.client';

@Module({
  exports: [
    KuaishouEcpmClient,
    KuaishouGameAuthClient,
    KuaishouOAuthClient,
    KuaishouTokenService,
  ],
  imports: [PrismaModule],
  providers: [
    KuaishouEcpmClient,
    KuaishouGameAuthClient,
    KuaishouOAuthClient,
    KuaishouTokenService,
  ],
})
export class KuaishouModule {}
