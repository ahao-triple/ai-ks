import { BadRequestException, ConflictException } from '@nestjs/common';
import { compare } from 'bcryptjs';
import {
  CompanyAdminService,
  READ_ONLY_OPERATION_CODES,
} from './company-admin.service';

describe('CompanyAdminService', () => {
  it('creates a company admin with a bcrypt hash and writes an audit log', async () => {
    const prisma = createFakePrisma();
    const service = new CompanyAdminService(prisma);

    const admin = await service.createCompanyAdmin({
      actor: superAdmin,
      displayName: 'Acme Admin',
      password: 'password123',
      username: 'acme-admin',
    });

    expect(admin).toMatchObject({
      displayName: 'Acme Admin',
      enabled: true,
      id: 'admin-1',
      username: 'acme-admin',
    });
    expect(admin.passwordHash).not.toBe('password123');
    await expect(compare('password123', admin.passwordHash)).resolves.toBe(true);
    expect(prisma.auditLogs).toEqual([
      expect.objectContaining({
        action: 'company_admin.created',
        actorId: 'root',
        actorType: 'SUPER_ADMIN',
        targetId: 'admin-1',
        targetType: 'company_admin',
      }),
    ]);
  });

  it('maps duplicate usernames to a conflict error', async () => {
    const prisma = createFakePrisma({
      companyAdmins: [
        {
          displayName: 'Existing',
          enabled: true,
          id: 'admin-existing',
          passwordHash: 'hash',
          username: 'acme-admin',
        },
      ],
    });
    const service = new CompanyAdminService(prisma);

    await expect(
      service.createCompanyAdmin({
        actor: superAdmin,
        displayName: 'Duplicate',
        password: 'password123',
        username: 'acme-admin',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('replaces scopes after validating active companies and games', async () => {
    const prisma = createFakePrisma({
      companies: [{ id: 'company-1', name: 'Acme' }],
      companyAdmins: [
        {
          displayName: 'Acme Admin',
          enabled: true,
          id: 'admin-1',
          passwordHash: 'hash',
          username: 'acme-admin',
        },
      ],
      games: [
        { companyId: 'company-1', id: 'game-b', name: 'B' },
        { companyId: 'company-1', id: 'game-a', name: 'A' },
      ],
      scopes: [
        {
          companyAdminId: 'admin-1',
          companyId: 'company-old',
          gameIds: ['game-old'],
          id: 'scope-old',
          operationCodes: ['company.read'],
        },
      ],
    });
    const service = new CompanyAdminService(prisma);

    const admin = await service.replaceScopes({
      actor: superAdmin,
      adminId: 'admin-1',
      scopes: [
        {
          companyId: 'company-1',
          gameIds: ['game-b', 'game-a', 'game-b'],
        },
      ],
    });

    expect(admin.scopes).toEqual([
      expect.objectContaining({
        companyAdminId: 'admin-1',
        companyId: 'company-1',
        gameIds: ['game-a', 'game-b'],
        operationCodes: READ_ONLY_OPERATION_CODES,
      }),
    ]);
    expect(prisma.auditLogs).toEqual([
      expect.objectContaining({
        action: 'company_admin.scopes_updated',
        metadata: {
          scopes: [
            {
              companyId: 'company-1',
              gameIds: ['game-a', 'game-b'],
              operationCodes: READ_ONLY_OPERATION_CODES,
            },
          ],
          username: 'acme-admin',
        },
        targetId: 'admin-1',
        targetType: 'company_admin',
      }),
    ]);
  });

  it('merges duplicate company scopes into canonical create and audit data', async () => {
    const prisma = createFakePrisma({
      companies: [{ id: 'company-1', name: 'Acme' }],
      companyAdmins: [
        {
          displayName: 'Acme Admin',
          enabled: true,
          id: 'admin-1',
          passwordHash: 'hash',
          username: 'acme-admin',
        },
      ],
      games: [
        { companyId: 'company-1', id: 'game-c', name: 'C' },
        { companyId: 'company-1', id: 'game-a', name: 'A' },
        { companyId: 'company-1', id: 'game-b', name: 'B' },
      ],
    });
    const service = new CompanyAdminService(prisma);

    await service.replaceScopes({
      actor: superAdmin,
      adminId: 'admin-1',
      scopes: [
        {
          companyId: 'company-1',
          gameIds: ['game-c', 'game-a'],
        },
        {
          companyId: 'company-1',
          gameIds: ['game-b', 'game-a'],
        },
      ],
    });

    expect(prisma.companyAdminScope.createMany).toHaveBeenCalledWith({
      data: [
        {
          companyAdminId: 'admin-1',
          companyId: 'company-1',
          gameIds: ['game-a', 'game-b', 'game-c'],
          operationCodes: READ_ONLY_OPERATION_CODES,
        },
      ],
    });
    expect(prisma.auditLogs).toEqual([
      expect.objectContaining({
        action: 'company_admin.scopes_updated',
        metadata: {
          scopes: [
            {
              companyId: 'company-1',
              gameIds: ['game-a', 'game-b', 'game-c'],
              operationCodes: READ_ONLY_OPERATION_CODES,
            },
          ],
          username: 'acme-admin',
        },
      }),
    ]);
  });

  it('rejects empty scope games when replaceScopes is called directly', async () => {
    const prisma = createFakePrisma({
      companies: [{ id: 'company-1', name: 'Acme' }],
      companyAdmins: [
        {
          displayName: 'Acme Admin',
          enabled: true,
          id: 'admin-1',
          passwordHash: 'hash',
          username: 'acme-admin',
        },
      ],
    });
    const service = new CompanyAdminService(prisma);

    await expect(
      service.replaceScopes({
        actor: superAdmin,
        adminId: 'admin-1',
        scopes: [{ companyId: 'company-1', gameIds: [] }],
      }),
    ).rejects.toThrow('Company admin scope games are invalid');
    expect(prisma.companyAdminScope.createMany).not.toHaveBeenCalled();
  });

  it('allows top-level empty scopes to clear all grants and audit the empty scope list', async () => {
    const prisma = createFakePrisma({
      companyAdmins: [
        {
          displayName: 'Acme Admin',
          enabled: true,
          id: 'admin-1',
          passwordHash: 'hash',
          username: 'acme-admin',
        },
      ],
      scopes: [
        {
          companyAdminId: 'admin-1',
          companyId: 'company-1',
          gameIds: ['game-a'],
          id: 'scope-1',
          operationCodes: ['company.read'],
        },
      ],
    });
    const service = new CompanyAdminService(prisma);

    const admin = await service.replaceScopes({
      actor: superAdmin,
      adminId: 'admin-1',
      scopes: [],
    });

    expect(prisma.companyAdminScope.deleteMany).toHaveBeenCalledWith({
      where: { companyAdminId: 'admin-1' },
    });
    expect(prisma.companyAdminScope.createMany).not.toHaveBeenCalled();
    expect(admin.scopes).toEqual([]);
    expect(prisma.auditLogs).toEqual([
      expect.objectContaining({
        action: 'company_admin.scopes_updated',
        metadata: {
          scopes: [],
          username: 'acme-admin',
        },
      }),
    ]);
  });

  it('rejects scope games that do not belong to the requested active company', async () => {
    const prisma = createFakePrisma({
      companies: [{ id: 'company-1', name: 'Acme' }],
      companyAdmins: [
        {
          displayName: 'Acme Admin',
          enabled: true,
          id: 'admin-1',
          passwordHash: 'hash',
          username: 'acme-admin',
        },
      ],
      games: [{ companyId: 'company-other', id: 'game-a', name: 'A' }],
    });
    const service = new CompanyAdminService(prisma);

    await expect(
      service.replaceScopes({
        actor: superAdmin,
        adminId: 'admin-1',
        scopes: [{ companyId: 'company-1', gameIds: ['game-a'] }],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

const superAdmin = {
  role: 'SUPER_ADMIN' as const,
  username: 'root',
};

type FakeCompany = {
  deletedAt?: Date | null;
  id: string;
  name: string;
};

type FakeGame = {
  companyId: string;
  deletedAt?: Date | null;
  id: string;
  name: string;
};

type FakeCompanyAdmin = {
  deletedAt?: Date | null;
  displayName: string;
  enabled: boolean;
  id: string;
  passwordHash: string;
  username: string;
};

type FakeScope = {
  companyAdminId: string;
  companyId: string;
  gameIds: string[];
  id: string;
  operationCodes: string[];
};

function createFakePrisma(seed: {
  companies?: FakeCompany[];
  companyAdmins?: FakeCompanyAdmin[];
  games?: FakeGame[];
  scopes?: FakeScope[];
} = {}) {
  const companies = [...(seed.companies ?? [])];
  const companyAdmins = [...(seed.companyAdmins ?? [])];
  const games = [...(seed.games ?? [])];
  const scopes = [...(seed.scopes ?? [])];
  const auditLogs: unknown[] = [];
  const now = new Date('2026-05-09T01:00:00.000Z');

  let prisma: any;
  prisma = {
    auditLogs,
    $transaction: jest.fn(async (callback: (tx: unknown) => unknown) =>
      callback(prisma),
    ),
    auditLog: {
      create: jest.fn(async ({ data }: { data: unknown }) => {
        auditLogs.push(data);
        return data;
      }),
    },
    company: {
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) =>
        companies.find((company) => company.id === where.id) ?? null,
      ),
    },
    companyAdminAccount: {
      create: jest.fn(async ({ data }: { data: Omit<FakeCompanyAdmin, 'id'> }) => {
        if (companyAdmins.some((admin) => admin.username === data.username)) {
          throw { code: 'P2002' };
        }
        const admin = {
          ...data,
          createdAt: now,
          deletedAt: null,
          id: `admin-${companyAdmins.length + 1}`,
          updatedAt: now,
        };
        companyAdmins.push(admin);
        return admin;
      }),
      findUnique: jest.fn(
        async ({
          include,
          where,
        }: {
          include?: { scopes?: boolean };
          where: { id?: string; username?: string };
        }) => {
          const admin =
            companyAdmins.find((item) =>
              where.id ? item.id === where.id : item.username === where.username,
            ) ?? null;
          if (!admin) {
            return null;
          }
          return include?.scopes
            ? {
                ...admin,
                scopes: scopes.filter((scope) => scope.companyAdminId === admin.id),
              }
            : admin;
        },
      ),
      update: jest.fn(),
      findMany: jest.fn(),
    },
    companyAdminScope: {
      createMany: jest.fn(async ({ data }: { data: FakeScope[] }) => {
        scopes.push(
          ...data.map((scope, index) => ({
            ...scope,
            id: `scope-${index + 1}`,
          })),
        );
        return { count: data.length };
      }),
      deleteMany: jest.fn(
        async ({ where }: { where: { companyAdminId: string } }) => {
          for (let index = scopes.length - 1; index >= 0; index -= 1) {
            if (scopes[index].companyAdminId === where.companyAdminId) {
              scopes.splice(index, 1);
            }
          }
          return { count: 1 };
        },
      ),
    },
    game: {
      findMany: jest.fn(
        async ({
          where,
        }: {
          where: {
            companyId: string;
            deletedAt: null;
            id: { in: string[] };
          };
        }) =>
          games.filter(
            (game) =>
              game.companyId === where.companyId &&
              !game.deletedAt &&
              where.id.in.includes(game.id),
          ),
      ),
    },
  };

  return prisma;
}
