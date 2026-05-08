import { UnauthorizedException } from '@nestjs/common';
import { AdminAuthService } from './admin-auth.service';
import { AdminJwtGuard } from './admin-jwt.guard';

describe('AdminJwtGuard', () => {
  it('attaches the verified admin principal to the request', async () => {
    const guard = new AdminJwtGuard({
      verifyAccessToken: async (token: string) => ({
        role: 'SUPER_ADMIN',
        username: `admin-${token}`,
      }),
    } as AdminAuthService);
    const request = {
      headers: {
        authorization: 'Bearer token-1',
      },
    };

    await expect(guard.canActivate(createContext(request))).resolves.toBe(true);

    expect(request).toEqual({
      admin: {
        role: 'SUPER_ADMIN',
        username: 'admin-token-1',
      },
      headers: {
        authorization: 'Bearer token-1',
      },
    });
  });

  it('rejects requests without a bearer token', async () => {
    const guard = new AdminJwtGuard({
      verifyAccessToken: async () => {
        throw new Error('should not verify');
      },
    } as unknown as AdminAuthService);

    await expect(
      guard.canActivate(createContext({ headers: {} })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('attaches company admin principals', async () => {
    const guard = new AdminJwtGuard({
      verifyAccessToken: async () => ({
        adminId: 'company-admin-1',
        displayName: '公司管理员',
        role: 'COMPANY_ADMIN',
        username: 'company_admin',
      }),
    } as unknown as AdminAuthService);
    const request = {
      headers: {
        authorization: 'Bearer token-1',
      },
    };

    await expect(guard.canActivate(createContext(request))).resolves.toBe(true);

    expect(request).toEqual({
      admin: {
        adminId: 'company-admin-1',
        displayName: '公司管理员',
        role: 'COMPANY_ADMIN',
        username: 'company_admin',
      },
      headers: {
        authorization: 'Bearer token-1',
      },
    });
  });
});

function createContext(request: unknown) {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as never;
}
