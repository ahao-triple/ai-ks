import { UnauthorizedException } from '@nestjs/common';
import { AccountJwtGuard } from './account-jwt.guard';
import { AccountAuthService } from './account-auth.service';

describe('AccountJwtGuard', () => {
  it('attaches the verified account principal to the request', async () => {
    const guard = new AccountJwtGuard({
      verifyAccessToken: async (token: string) => ({
        id: `verified-${token}`,
        readableId: 'ABC1234',
        username: 'alice',
      }),
    } as AccountAuthService);
    const request = {
      headers: {
        authorization: 'Bearer token-1',
      },
    };

    await expect(guard.canActivate(createContext(request))).resolves.toBe(true);

    expect(request).toEqual({
      account: {
        id: 'verified-token-1',
        readableId: 'ABC1234',
        username: 'alice',
      },
      headers: {
        authorization: 'Bearer token-1',
      },
    });
  });

  it('rejects requests without a bearer token', async () => {
    const guard = new AccountJwtGuard({
      verifyAccessToken: async () => {
        throw new Error('should not verify');
      },
    } as unknown as AccountAuthService);

    await expect(
      guard.canActivate(createContext({ headers: {} })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

function createContext(request: unknown) {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as never;
}
