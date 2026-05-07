import { Module } from '@nestjs/common';
import { KuaishouEcpmClient } from './kuaishou-ecpm.client';
import { KuaishouGameAuthClient } from './kuaishou-game-auth.client';

@Module({
  exports: [KuaishouEcpmClient, KuaishouGameAuthClient],
  providers: [KuaishouEcpmClient, KuaishouGameAuthClient],
})
export class KuaishouModule {}
