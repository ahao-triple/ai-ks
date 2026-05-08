import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { hash } from 'bcryptjs';
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

  it('logs in a company admin and verifies a company admin token', async () => {
    const prisma = createCompanyAdminPrisma([
      {
        deletedAt: null,
        displayName: '上海运营',
        enabled: true,
        id: 'company-admin-1',
        passwordHash: await hash('companypass', 10),
        username: 'company_admin',
      },
    ]);
    const service = createService(prisma);

    const login = await service.login({
      password: 'companypass',
      username: 'company_admin',
    });
    const principal = await service.verifyAccessToken(login.accessToken);

    expect(login.admin).toEqual({
      adminId: 'company-admin-1',
      displayName: '上海运营',
      role: 'COMPANY_ADMIN',
      username: 'company_admin',
    });
    expect(principal).toEqual(login.admin);
  });

  it('rejects company admin tokens when the account is disabled during verification', async () => {
    const companyAdmin = createCompanyAdmin();
    const service = createService(createCompanyAdminPrisma([companyAdmin]));
    const token = await issueCompanyAdminToken(service, companyAdmin);

    companyAdmin.enabled = false;

    await expect(service.verifyAccessToken(token)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects company admin tokens when the account is deleted during verification', async () => {
    const companyAdmin = createCompanyAdmin();
    const service = createService(createCompanyAdminPrisma([companyAdmin]));
    const token = await issueCompanyAdminToken(service, companyAdmin);

    companyAdmin.deletedAt = new Date('2026-05-09T00:00:00.000Z');

    await expect(service.verifyAccessToken(token)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects company admin tokens when the username no longer matches token subject', async () => {
    const companyAdmin = createCompanyAdmin();
    const service = createService(createCompanyAdminPrisma([companyAdmin]));
    const token = await issueCompanyAdminToken(service, companyAdmin);

    companyAdmin.username = 'renamed_admin';

    await expect(service.verifyAccessToken(token)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects disabled and deleted company admins', async () => {
    const disabled = createService(
      createCompanyAdminPrisma([
        {
          deletedAt: null,
          displayName: 'disabled',
          enabled: false,
          id: 'disabled-admin',
          passwordHash: await hash('companypass', 10),
          username: 'disabled_admin',
        },
      ]),
    );

    await expect(
      disabled.login({ password: 'companypass', username: 'disabled_admin' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    const deleted = createService(
      createCompanyAdminPrisma([
        {
          deletedAt: new Date('2026-01-01T00:00:00.000Z'),
          displayName: 'deleted',
          enabled: true,
          id: 'deleted-admin',
          passwordHash: await hash('companypass', 10),
          username: 'deleted_admin',
        },
      ]),
    );

    await expect(
      deleted.login({ password: 'companypass', username: 'deleted_admin' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

type FakeCompanyAdmin = {
  deletedAt: Date | null;
  displayName: string;
  enabled: boolean;
  id: string;
  passwordHash: string;
  username: string;
};

function createCompanyAdmin(): FakeCompanyAdmin {
  return {
    deletedAt: null,
    displayName: '上海运营',
    enabled: true,
    id: 'company-admin-1',
    passwordHash: 'unused-in-verify',
    username: 'company_admin',
  };
}

function issueCompanyAdminToken(
  service: AdminAuthService,
  companyAdmin: FakeCompanyAdmin,
) {
  return service.issueAccessToken({
    adminId: companyAdmin.id,
    displayName: companyAdmin.displayName,
    role: 'COMPANY_ADMIN',
    username: companyAdmin.username,
  });
}

function createCompanyAdminPrisma(admins: FakeCompanyAdmin[] = []) {
  return {
    companyAdminAccount: {
      findUnique: jest.fn(
        async ({ where }: { where: { id?: string; username?: string } }) =>
          admins.find((admin) =>
            where.id ? admin.id === where.id : admin.username === where.username,
          ) ?? null,
      ),
    },
  };
}

function createService(prisma = createCompanyAdminPrisma()) {
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
    prisma as never,
  );
}
