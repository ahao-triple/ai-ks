import { ForbiddenException, Logger } from '@nestjs/common';
import { AdminAccessControlService } from './admin-access-control.service';
import { type CompanyAdminPrincipal } from './admin-auth.service';

describe('AdminAccessControlService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('resolves unrestricted read scope for super admins', async () => {
    const { service } = createService();

    await expect(
      service.resolveReadScope({
        role: 'SUPER_ADMIN',
        username: 'admin',
      }),
    ).resolves.toEqual({
      companyIds: undefined,
      gameAppIds: undefined,
      gameIds: undefined,
      isSuperAdmin: true,
    });
  });

  it('resolves deduplicated active company admin read scope', async () => {
    const { prisma, service } = createService({
      activeGames: [
        { gameAppId: 'app-3', id: 'game-3' },
        { gameAppId: 'app-1', id: 'game-1' },
      ],
      scopes: [
        {
          companyId: 'company-b',
          gameIds: ['game-3', 'game-deleted', 'game-1'],
        },
        {
          companyId: 'company-a',
          gameIds: ['game-1', 'game-3'],
        },
      ],
    });

    await expect(service.resolveReadScope(createCompanyAdmin())).resolves.toEqual(
      {
        companyIds: ['company-a', 'company-b'],
        gameAppIds: ['app-1', 'app-3'],
        gameIds: ['game-1', 'game-3'],
        isSuperAdmin: false,
      },
    );
    expect(prisma.companyAdminScope.findMany).toHaveBeenCalledWith({
      where: {
        companyAdminId: 'company-admin-1',
      },
    });
    expect(prisma.game.findMany).toHaveBeenCalledWith({
      select: {
        gameAppId: true,
        id: true,
      },
      where: {
        deletedAt: null,
        id: {
          in: ['game-1', 'game-3', 'game-deleted'],
        },
      },
    });
  });

  it('returns empty read scope without loading games when company admin has no scopes', async () => {
    const { prisma, service } = createService();

    await expect(service.resolveReadScope(createCompanyAdmin())).resolves.toEqual(
      {
        companyIds: [],
        gameAppIds: [],
        gameIds: [],
        isSuperAdmin: false,
      },
    );
    expect(prisma.game.findMany).not.toHaveBeenCalled();
  });

  it('returns empty read scope without loading games when scopes have no game ids', async () => {
    const { prisma, service } = createService({
      scopes: [
        {
          companyId: 'company-a',
          gameIds: [],
        },
      ],
    });

    await expect(service.resolveReadScope(createCompanyAdmin())).resolves.toEqual(
      {
        companyIds: [],
        gameAppIds: [],
        gameIds: [],
        isSuperAdmin: false,
      },
    );
    expect(prisma.game.findMany).not.toHaveBeenCalled();
  });

  it('does not expose companies whose scopes only reference deleted or inactive games', async () => {
    const { service } = createService({
      activeGames: [],
      scopes: [
        {
          companyId: 'company-a',
          gameIds: ['game-deleted', 'game-inactive'],
        },
      ],
    });

    await expect(service.resolveReadScope(createCompanyAdmin())).resolves.toEqual(
      {
        companyIds: [],
        gameAppIds: [],
        gameIds: [],
        isSuperAdmin: false,
      },
    );
  });

  it('records denied audit and rejects company admin super-admin operations', async () => {
    const { prisma, service } = createService();

    await expect(
      service.assertSuperAdmin(createCompanyAdmin(), {
        method: 'POST',
        path: '/api/admin/games',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        action: 'permission.denied',
        actorId: 'company-admin-1',
        actorType: 'COMPANY_ADMIN',
        metadata: expect.objectContaining({
          method: 'POST',
          path: '/api/admin/games',
          reason: 'super_admin_required',
        }),
        targetId: 'POST /api/admin/games',
        targetType: 'admin_route',
      },
    });
  });

  it('still rejects company admin super-admin operations when denied audit fails', async () => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    const { service } = createService({
      auditError: new Error('audit unavailable'),
    });

    await expect(
      service.assertSuperAdmin(createCompanyAdmin(), {
        method: 'PATCH',
        path: '/api/admin/games/game-1',
      }),
    ).rejects.toThrow(new ForbiddenException('无权限访问该操作'));
  });
});

type FakeScope = {
  companyId: string;
  gameIds: string[];
};

type FakeGame = {
  gameAppId: string;
  id: string;
};

function createService(
  input: { activeGames?: FakeGame[]; auditError?: Error; scopes?: FakeScope[] } = {},
) {
  const prisma = {
    auditLog: {
      create: jest.fn(
        input.auditError
          ? () => Promise.reject(input.auditError)
          : () => Promise.resolve({ id: 'audit-1' }),
      ),
    },
    companyAdminScope: {
      findMany: jest.fn().mockResolvedValue(input.scopes ?? []),
    },
    game: {
      findMany: jest.fn().mockResolvedValue(input.activeGames ?? []),
    },
  };

  return {
    prisma,
    service: new AdminAccessControlService(prisma as never),
  };
}

function createCompanyAdmin(): CompanyAdminPrincipal {
  return {
    adminId: 'company-admin-1',
    displayName: '上海运营',
    role: 'COMPANY_ADMIN',
    username: 'company_admin',
  };
}
