import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AdminAuthService } from './admin-auth.service';

describe('AdminAuthService', () => {
  it('logs in a configured super admin and verifies the access token', async () => {
    const service = createService();

    const login = await service.login({
      password: 'admin123456',
      username: 'admin',
    });
    const principal = await service.verifyAccessToken(login.accessToken);

    expect(login.admin).toEqual({
      role: 'SUPER_ADMIN',
      username: 'admin',
    });
    expect(principal).toEqual(login.admin);
  });

  it('rejects invalid admin credentials and tokens', async () => {
    const service = createService();

    await expect(
      service.login({
        password: 'wrong',
        username: 'admin',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    await expect(service.verifyAccessToken('invalid')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});

function createService() {
  return new AdminAuthService(
    new JwtService(),
    {
      get: (key: string) => {
        const values: Record<string, string> = {
          ADMIN_JWT_EXPIRES_IN: '1h',
          ADMIN_JWT_SECRET: 'admin-secret',
          ADMIN_PASSWORD: 'admin123456',
          ADMIN_USERNAME: 'admin',
        };

        return values[key];
      },
    } as ConfigService,
  );
}
