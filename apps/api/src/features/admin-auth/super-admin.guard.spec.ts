import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { AdminAccessControlService } from './admin-access-control.service';
import { type AdminPrincipal } from './admin-auth.service';
import { SuperAdminGuard } from './super-admin.guard';

describe('SuperAdminGuard', () => {
  it('rejects requests without an admin principal', async () => {
    const { accessControlService, guard } = createGuard();

    await expect(guard.canActivate(createContext({}))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(accessControlService.assertSuperAdmin).not.toHaveBeenCalled();
  });

  it('delegates company admin authorization failures to access control', async () => {
    const { accessControlService, guard } = createGuard({
      rejectWith: new ForbiddenException('无权限访问该操作'),
    });
    const admin = createCompanyAdmin();

    await expect(
      guard.canActivate(
        createContext({
          admin,
          method: 'POST',
          originalUrl: '/api/admin/games',
        }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(accessControlService.assertSuperAdmin).toHaveBeenCalledWith(admin, {
      method: 'POST',
      path: '/api/admin/games',
    });
  });

  it('allows super admins and passes method and original URL to access control', async () => {
    const { accessControlService, guard } = createGuard();
    const admin: AdminPrincipal = {
      role: 'SUPER_ADMIN',
      username: 'admin',
    };

    await expect(
      guard.canActivate(
        createContext({
          admin,
          method: 'DELETE',
          originalUrl: '/api/admin/games/game-1',
          url: '/fallback',
        }),
      ),
    ).resolves.toBe(true);
    expect(accessControlService.assertSuperAdmin).toHaveBeenCalledWith(admin, {
      method: 'DELETE',
      path: '/api/admin/games/game-1',
    });
  });
});

function createGuard(input: { rejectWith?: Error } = {}) {
  const accessControlService = {
    assertSuperAdmin: jest.fn(
      input.rejectWith
        ? () => Promise.reject(input.rejectWith)
        : () => Promise.resolve(),
    ),
  };

  return {
    accessControlService,
    guard: new SuperAdminGuard(
      accessControlService as unknown as AdminAccessControlService,
    ),
  };
}

function createContext(request: unknown) {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as never;
}

function createCompanyAdmin(): AdminPrincipal {
  return {
    adminId: 'company-admin-1',
    displayName: '上海运营',
    role: 'COMPANY_ADMIN',
    username: 'company_admin',
  };
}
