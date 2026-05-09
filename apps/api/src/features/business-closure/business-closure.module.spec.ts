import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { resolveWorkspaceEnvPath } from '../../common/env/workspace-env';
import { BusinessClosureModule } from './business-closure.module';
import { BusinessClosureService } from './business-closure.service';

describe('BusinessClosureModule', () => {
  it('wires the admin guards and business closure service', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          envFilePath: resolveWorkspaceEnvPath(),
          isGlobal: true,
        }),
        BusinessClosureModule,
      ],
    }).compile();

    expect(moduleRef.get(BusinessClosureService)).toBeInstanceOf(
      BusinessClosureService,
    );

    await moduleRef.close();
  });
});
