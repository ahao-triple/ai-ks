import { BadRequestException } from '@nestjs/common';
import { CompanyAdminController } from './company-admin.controller';
import { READ_ONLY_OPERATION_CODES } from './company-admin.service';

describe('CompanyAdminController', () => {
  it('rejects short passwords when creating company admins', async () => {
    const controller = new CompanyAdminController(createService() as never);

    await expect(
      controller.create(superAdmin, {
        displayName: 'Acme Admin',
        password: 'short',
        username: 'acme-admin',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('passes trimmed scope input to the service', async () => {
    const service = createService();
    const controller = new CompanyAdminController(service as never);

    await controller.replaceScopes(superAdmin, ' admin-1 ', {
      scopes: [
        {
          companyId: ' company-1 ',
          gameIds: [' game-b ', 'game-a'],
        },
      ],
    });

    expect(service.lastReplaceScopesInput).toEqual({
      actor: superAdmin,
      adminId: 'admin-1',
      scopes: [
        {
          companyId: 'company-1',
          gameIds: ['game-b', 'game-a'],
        },
      ],
    });
  });

  it('rejects empty game ids in a company admin scope', async () => {
    const controller = new CompanyAdminController(createService() as never);

    await expect(
      controller.replaceScopes(superAdmin, 'admin-1', {
        scopes: [{ companyId: 'company-1', gameIds: [] }],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('does not expose passwordHash in presented admins', async () => {
    const controller = new CompanyAdminController(createService() as never);

    const result = await controller.list();

    expect(result).toEqual({
      admins: [
        {
          createdAt: '2026-05-09T01:00:00.000Z',
          deletedAt: null,
          displayName: 'Acme Admin',
          enabled: true,
          id: 'admin-1',
          scopes: [
            {
              companyId: 'company-1',
              gameIds: ['game-a'],
              operationCodes: READ_ONLY_OPERATION_CODES,
            },
          ],
          updatedAt: '2026-05-09T01:10:00.000Z',
          username: 'acme-admin',
        },
      ],
    });
    expect(JSON.stringify(result)).not.toContain('passwordHash');
  });
});

const superAdmin = {
  role: 'SUPER_ADMIN' as const,
  username: 'root',
};

function createService() {
  const admin = {
    createdAt: new Date('2026-05-09T01:00:00.000Z'),
    deletedAt: null,
    displayName: 'Acme Admin',
    enabled: true,
    id: 'admin-1',
    passwordHash: 'secret-hash',
    scopes: [
      {
        companyId: 'company-1',
        gameIds: ['game-a'],
        operationCodes: [...READ_ONLY_OPERATION_CODES],
      },
    ],
    updatedAt: new Date('2026-05-09T01:10:00.000Z'),
    username: 'acme-admin',
  };

  return {
    lastReplaceScopesInput: undefined as unknown,
    createCompanyAdmin: jest.fn(async () => admin),
    listCompanyAdmins: jest.fn(async () => [admin]),
    replaceScopes: jest.fn(async function (this: {
      lastReplaceScopesInput: unknown;
    }, input: unknown) {
      this.lastReplaceScopesInput = input;
      return admin;
    }),
    updateCompanyAdmin: jest.fn(async () => admin),
  };
}
