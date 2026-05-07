import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AccountAuthService } from './account-auth.service';

describe('AccountAuthService', () => {
  it('issues and verifies account access tokens', async () => {
    const service = createService();

    const accessToken = await service.issueAccessToken({
      id: 'user-1',
      readableId: 'ABC1234',
      username: 'alice',
    });
    const principal = await service.verifyAccessToken(accessToken);

    expect(typeof accessToken).toBe('string');
    expect(principal).toEqual({
      id: 'user-1',
      readableId: 'ABC1234',
      username: 'alice',
    });
  });

  it('rejects invalid account access tokens', async () => {
    const service = createService();

    await expect(service.verifyAccessToken('not-a-token')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});

function createService() {
  return new AccountAuthService(
    new JwtService(),
    {
      get: (key: string) => {
        if (key === 'JWT_SECRET') {
          return 'test-secret';
        }

        if (key === 'JWT_EXPIRES_IN') {
          return '1h';
        }

        return undefined;
      },
    } as ConfigService,
  );
}
