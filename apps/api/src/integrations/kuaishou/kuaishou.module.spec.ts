import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { KuaishouTokenService } from '../../features/kuaishou-admin/kuaishou-token.service';
import { KuaishouModule } from './kuaishou.module';

describe('KuaishouModule', () => {
  it('resolves token-managed kuaishou providers through Nest DI', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true }), KuaishouModule],
    }).compile();

    expect(moduleRef.get(KuaishouTokenService)).toBeInstanceOf(
      KuaishouTokenService,
    );

    await moduleRef.close();
  });
});
