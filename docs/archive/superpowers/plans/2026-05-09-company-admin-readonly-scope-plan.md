# Company Admin Read-Only Scopes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add company-admin accounts that can log into the existing admin workspace and read only the companies, games, settlements, ECPM jobs, and safe audit logs within their assigned game scope.

**Architecture:** Extend Prisma with `CompanyAdminAccount` and a typed `CompanyAdminScope` relation, then make admin authentication role-aware. Add reusable admin access helpers for super-admin-only writes and company-admin scope resolution. Apply read filters in existing admin services/controllers and update the frontend to show a read-only company-admin experience while keeping all write authorization enforced by the API.

**Tech Stack:** NestJS 11, Prisma 6, PostgreSQL, bcryptjs, JWT, Jest, React 19, Vite, TypeScript.

---

## File Structure

- Modify `apps/api/prisma/schema.prisma`
  - Adds `CompanyAdminAccount`.
  - Renames the Prisma-level `CompanyAdminScope.principalId` field to `companyAdminId` while preserving database column `principal_id`.
- Modify `apps/api/src/common/prisma/prisma-schema-guard.ts`
  - Adds the new company-admin schema columns to startup schema checks.
- Modify `apps/api/src/common/prisma/prisma-schema-guard.spec.ts`
  - Covers new required columns.
- Modify `apps/api/src/features/admin-auth/admin-auth.module.ts`
  - Imports `PrismaModule` and exports new access-control helpers.
- Modify `apps/api/src/features/admin-auth/admin-auth.service.ts`
  - Supports `SUPER_ADMIN` and `COMPANY_ADMIN` login/token verification.
- Modify `apps/api/src/features/admin-auth/admin-auth.controller.ts`
  - Adds `GET /api/admin/auth/me`.
- Modify `apps/api/src/features/admin-auth/admin-auth.service.spec.ts`
  - Covers super-admin compatibility and company-admin auth.
- Modify `apps/api/src/features/admin-auth/admin-jwt.guard.spec.ts`
  - Covers company-admin principal attachment.
- Create `apps/api/src/features/admin-auth/admin-access-control.service.ts`
  - Resolves company-admin scopes and records permission-denied audit rows.
- Create `apps/api/src/features/admin-auth/super-admin.guard.ts`
  - Requires `SUPER_ADMIN` for write/config routes.
- Create `apps/api/src/features/admin-auth/admin-access-control.service.spec.ts`
  - Covers scope filtering and denied audit metadata.
- Create `apps/api/src/features/company-admin/company-admin.module.ts`
  - Owns super-admin management endpoints for company-admin accounts.
- Create `apps/api/src/features/company-admin/company-admin.service.ts`
  - Creates, updates, lists, and scopes company-admin accounts.
- Create `apps/api/src/features/company-admin/company-admin.controller.ts`
  - Exposes `/api/admin/company-admins`.
- Create `apps/api/src/features/company-admin/company-admin.service.spec.ts`
  - Unit tests account and scope management.
- Create `apps/api/src/features/company-admin/company-admin.controller.spec.ts`
  - Controller-level validation and guard metadata tests.
- Modify `apps/api/src/app.module.ts`
  - Imports `CompanyAdminModule`.
- Modify `apps/api/src/features/admin-resources/admin-resources.controller.ts`
  - Applies `SuperAdminGuard` to writes.
  - Passes current admin into list endpoints.
- Modify `apps/api/src/features/admin-resources/admin-resources.service.ts`
  - Filters companies/games for company admins.
- Modify `apps/api/src/features/admin-resources/admin-resources.service.spec.ts`
  - Covers company-admin list filtering.
- Modify `apps/api/src/features/settlement-admin/settlement-admin.controller.ts`
  - Makes preview/confirm super-admin-only.
  - Passes current admin to list/detail.
- Modify `apps/api/src/features/settlement-admin/settlement-admin.service.ts`
  - Filters list/detail for company admins.
- Modify `apps/api/src/features/settlement-admin/settlement-admin.service.spec.ts`
  - Covers company-admin settlement filters.
- Modify `apps/api/src/features/kuaishou-admin/kuaishou-refresh.controller.ts`
  - Makes manual refresh super-admin-only.
  - Filters ECPM jobs by authorized game app IDs.
- Modify `apps/api/src/features/kuaishou-admin/kuaishou-ecpm-sync-job.service.ts`
  - Supports `gameAppIds` list filter.
- Modify `apps/api/src/features/kuaishou-admin/kuaishou-ecpm-sync-job.service.spec.ts`
  - Covers multi-game job filtering.
- Modify `apps/api/src/features/kuaishou-admin/kuaishou-token.controller.ts`
  - Makes all token endpoints super-admin-only.
- Modify `apps/api/src/features/audit/audit-log.controller.ts`
  - Passes current admin to audit list.
- Modify `apps/api/src/features/audit/audit-log.service.ts`
  - Filters safe company-admin audit logs.
- Modify `apps/api/src/features/audit/audit-log.service.spec.ts`
  - Covers safe audit filtering.
- Modify `apps/api/src/features/withdrawal-admin/withdrawal-review.controller.ts`
  - Makes approve/pay/close super-admin-only.
  - Returns empty read-only withdrawal lists for company admins in this MVP.
- Modify `apps/api/src/features/withdrawal-admin/withdrawal-review.service.ts`
  - Adds company-admin list behavior.
- Modify `apps/api/src/features/withdrawal-admin/withdrawal-detail.service.ts`
  - For company admins, returns `403` because current withdrawal rows lack reliable game scope.
- Modify related withdrawal specs.
- Modify `apps/web/src/types/api.ts`
  - Adds company-admin admin principal and management types.
- Modify `apps/web/src/lib/aiKsApi.ts`
  - Adds `/admin/auth/me` and company-admin management client calls.
- Modify `apps/web/src/lib/aiKsApi.test.ts`
  - Covers new client routes and types.
- Modify `apps/web/src/app/session.ts`
  - Stores admin role/display in admin sessions.
- Modify `apps/web/src/app/session.test.ts`
  - Covers company-admin visible nav.
- Modify `apps/web/src/App.tsx`
  - Restores admin principal via `/admin/auth/me`.
  - Skips super-admin-only loads/actions for company admins.
  - Wires company-admin management state/actions for super admins.
- Modify `apps/web/src/pages/OperationsWorkspace.tsx`
  - Adds role-aware read-only UI and super-admin company-admin management panel.
- Modify `apps/web/src/pages/pages.test.tsx`
  - Covers company-admin read-only rendering and super-admin management UI.

---

## Task 1: Prisma Company Admin Schema

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Modify: `apps/api/src/common/prisma/prisma-schema-guard.ts`
- Modify: `apps/api/src/common/prisma/prisma-schema-guard.spec.ts`

- [ ] **Step 1: Write the failing schema guard test**

Add this expectation to `apps/api/src/common/prisma/prisma-schema-guard.spec.ts`:

```ts
it('requires company admin account and scope columns', async () => {
  const requiredNames = REQUIRED_PRISMA_SCHEMA_COLUMNS.map(
    (column) => `${column.tableName}.${column.columnName}`,
  );

  expect(requiredNames).toEqual(
    expect.arrayContaining([
      'company_admin_accounts.username',
      'company_admin_accounts.password_hash',
      'company_admin_accounts.display_name',
      'company_admin_accounts.enabled',
      'company_admin_scopes.principal_id',
      'company_admin_scopes.game_ids',
      'company_admin_scopes.operation_codes',
    ]),
  );
});
```

- [ ] **Step 2: Run the guard test to verify it fails**

Run:

```bash
pnpm --filter api test -- prisma-schema-guard.spec.ts
```

Expected: FAIL because the new company-admin required columns are not in `REQUIRED_PRISMA_SCHEMA_COLUMNS`.

- [ ] **Step 3: Extend Prisma schema**

Modify `apps/api/prisma/schema.prisma`.

Add this relation field to `Company`:

```prisma
companyAdminScopes CompanyAdminScope[]
```

Add this model after `Agent`:

```prisma
model CompanyAdminAccount {
  id           String    @id @default(uuid())
  username     String    @unique
  passwordHash String    @map("password_hash")
  displayName  String    @map("display_name")
  enabled      Boolean   @default(true)
  createdAt    DateTime  @default(now()) @map("created_at")
  updatedAt    DateTime  @updatedAt @map("updated_at")
  deletedAt    DateTime? @map("deleted_at")

  scopes CompanyAdminScope[]

  @@index([enabled])
  @@map("company_admin_accounts")
}
```

Replace the existing `CompanyAdminScope` model with:

```prisma
model CompanyAdminScope {
  id             String   @id @default(uuid())
  companyId      String   @map("company_id")
  companyAdminId String   @map("principal_id")
  gameIds        String[] @map("game_ids")
  operationCodes String[] @map("operation_codes")
  createdAt      DateTime @default(now()) @map("created_at")

  company      Company             @relation(fields: [companyId], references: [id])
  companyAdmin CompanyAdminAccount @relation(fields: [companyAdminId], references: [id])

  @@index([companyId])
  @@index([companyAdminId])
  @@map("company_admin_scopes")
}
```

- [ ] **Step 4: Extend schema boot required columns**

In `apps/api/src/common/prisma/prisma-schema-guard.ts`, append these entries to `REQUIRED_PRISMA_SCHEMA_COLUMNS`:

```ts
  { tableName: 'company_admin_accounts', columnName: 'username' },
  { tableName: 'company_admin_accounts', columnName: 'password_hash' },
  { tableName: 'company_admin_accounts', columnName: 'display_name' },
  { tableName: 'company_admin_accounts', columnName: 'enabled' },
  { tableName: 'company_admin_scopes', columnName: 'principal_id' },
  { tableName: 'company_admin_scopes', columnName: 'game_ids' },
  { tableName: 'company_admin_scopes', columnName: 'operation_codes' },
```

- [ ] **Step 5: Validate and generate Prisma client**

Run:

```bash
pnpm --filter api prisma:validate
pnpm --filter api prisma:generate
```

Expected: both PASS.

- [ ] **Step 6: Run focused guard tests**

Run:

```bash
pnpm --filter api test -- prisma-schema-guard.spec.ts
```

Expected: PASS.

- [ ] **Step 7: Commit schema changes**

Run:

```bash
git add apps/api/prisma/schema.prisma apps/api/src/common/prisma/prisma-schema-guard.ts apps/api/src/common/prisma/prisma-schema-guard.spec.ts
git commit -m "feat(api): add company admin schema"
```

---

## Task 2: Role-Aware Admin Authentication

**Files:**
- Modify: `apps/api/src/features/admin-auth/admin-auth.module.ts`
- Modify: `apps/api/src/features/admin-auth/admin-auth.service.ts`
- Modify: `apps/api/src/features/admin-auth/admin-auth.controller.ts`
- Modify: `apps/api/src/features/admin-auth/admin-auth.service.spec.ts`
- Modify: `apps/api/src/features/admin-auth/admin-jwt.guard.spec.ts`

- [ ] **Step 1: Write failing admin-auth tests**

Extend `apps/api/src/features/admin-auth/admin-auth.service.spec.ts` with fake Prisma support:

```ts
import { hash } from 'bcryptjs';

type FakeCompanyAdmin = {
  deletedAt: Date | null;
  displayName: string;
  enabled: boolean;
  id: string;
  passwordHash: string;
  username: string;
};

function createCompanyAdminPrisma(admins: FakeCompanyAdmin[] = []) {
  return {
    companyAdminAccount: {
      findUnique: jest.fn(async ({ where }: { where: { id?: string; username?: string } }) =>
        admins.find((admin) =>
          where.id ? admin.id === where.id : admin.username === where.username,
        ) ?? null,
      ),
    },
  };
}
```

Add these tests:

```ts
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
```

Update the existing helper signature:

```ts
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
```

- [ ] **Step 2: Run auth tests to verify they fail**

Run:

```bash
pnpm --filter api test -- admin-auth.service.spec.ts admin-jwt.guard.spec.ts
```

Expected: FAIL because `AdminAuthService` does not accept Prisma and company-admin principals are not supported.

- [ ] **Step 3: Implement role-aware principal types and auth**

Replace the top of `apps/api/src/features/admin-auth/admin-auth.service.ts` with these exported types:

```ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import { compare } from 'bcryptjs';
import { PrismaService } from '../../common/prisma/prisma.service';

type AdminAuthPrisma = Pick<PrismaService, 'companyAdminAccount'>;

export type SuperAdminPrincipal = {
  role: 'SUPER_ADMIN';
  username: string;
};

export type CompanyAdminPrincipal = {
  adminId: string;
  displayName: string;
  role: 'COMPANY_ADMIN';
  username: string;
};

export type AdminPrincipal = CompanyAdminPrincipal | SuperAdminPrincipal;

export function getAdminActorId(admin: AdminPrincipal): string {
  return admin.role === 'COMPANY_ADMIN' ? admin.adminId : admin.username;
}

export type AdminLoginInput = {
  password: string;
  username: string;
};

type AdminTokenPayload = {
  adminId?: string;
  role: 'COMPANY_ADMIN' | 'SUPER_ADMIN';
  sub: string;
  typ: 'admin';
};
```

Update the constructor:

```ts
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: AdminAuthPrisma,
  ) {}
```

Update `login()` to:

```ts
  async login(input: AdminLoginInput) {
    const superUsername = this.resolveUsername();
    const superPassword = this.resolvePassword();
    if (input.username === superUsername && input.password === superPassword) {
      const admin: AdminPrincipal = {
        role: 'SUPER_ADMIN',
        username: superUsername,
      };

      return {
        accessToken: await this.issueAccessToken(admin),
        admin,
      };
    }

    const companyAdmin = await this.prisma.companyAdminAccount.findUnique({
      where: {
        username: input.username,
      },
    });
    if (
      !companyAdmin ||
      companyAdmin.deletedAt ||
      !companyAdmin.enabled ||
      !(await compare(input.password, companyAdmin.passwordHash))
    ) {
      throw new UnauthorizedException('管理员账号或密码错误');
    }

    const admin: AdminPrincipal = {
      adminId: companyAdmin.id,
      displayName: companyAdmin.displayName,
      role: 'COMPANY_ADMIN',
      username: companyAdmin.username,
    };

    return {
      accessToken: await this.issueAccessToken(admin),
      admin,
    };
  }
```

Update `issueAccessToken()` payload:

```ts
  async issueAccessToken(admin: AdminPrincipal): Promise<string> {
    return this.jwtService.signAsync(
      {
        ...(admin.role === 'COMPANY_ADMIN' ? { adminId: admin.adminId } : {}),
        role: admin.role,
        sub: admin.username,
        typ: 'admin',
      } satisfies AdminTokenPayload,
      {
        expiresIn: this.resolveExpiresIn(),
        secret: this.resolveSecret(),
      },
    );
  }
```

Update `verifyAccessToken()` role handling:

```ts
      if (payload.typ !== 'admin' || !payload.sub) {
        throw new UnauthorizedException('管理员登录已失效，请重新登录');
      }

      if (payload.role === 'SUPER_ADMIN') {
        return {
          role: 'SUPER_ADMIN',
          username: payload.sub,
        };
      }

      if (payload.role === 'COMPANY_ADMIN' && payload.adminId) {
        const companyAdmin = await this.prisma.companyAdminAccount.findUnique({
          where: {
            id: payload.adminId,
          },
        });
        if (
          !companyAdmin ||
          companyAdmin.deletedAt ||
          !companyAdmin.enabled ||
          companyAdmin.username !== payload.sub
        ) {
          throw new UnauthorizedException('管理员登录已失效，请重新登录');
        }

        return {
          adminId: companyAdmin.id,
          displayName: companyAdmin.displayName,
          role: 'COMPANY_ADMIN',
          username: companyAdmin.username,
        };
      }

      throw new UnauthorizedException('管理员登录已失效，请重新登录');
```

- [ ] **Step 4: Update auth module and controller**

Modify `apps/api/src/features/admin-auth/admin-auth.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { AdminAuthController } from './admin-auth.controller';
import { AdminAuthService } from './admin-auth.service';
import { AdminJwtGuard } from './admin-jwt.guard';

@Module({
  controllers: [AdminAuthController],
  exports: [AdminAuthService, AdminJwtGuard],
  imports: [JwtModule.register({}), PrismaModule],
  providers: [AdminAuthService, AdminJwtGuard],
})
export class AdminAuthModule {}
```

Modify `apps/api/src/features/admin-auth/admin-auth.controller.ts`:

```ts
import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { AdminAuthService } from './admin-auth.service';
import { AdminJwtGuard } from './admin-jwt.guard';
import { CurrentAdmin } from './current-admin.decorator';
import { type AdminPrincipal } from './admin-auth.service';

// existing schema stays unchanged

  @Get('me')
  @UseGuards(AdminJwtGuard)
  me(@CurrentAdmin() admin: AdminPrincipal) {
    return {
      admin,
    };
  }
```

- [ ] **Step 5: Update AdminJwtGuard test for company-admin principal**

Add this test to `apps/api/src/features/admin-auth/admin-jwt.guard.spec.ts`:

```ts
it('attaches company admin principals', async () => {
  const guard = new AdminJwtGuard({
    verifyAccessToken: async () => ({
      adminId: 'company-admin-1',
      displayName: '公司管理员',
      role: 'COMPANY_ADMIN',
      username: 'company_admin',
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
```

- [ ] **Step 6: Run focused auth tests**

Run:

```bash
pnpm --filter api test -- admin-auth.service.spec.ts admin-jwt.guard.spec.ts
```

Expected: PASS.

- [ ] **Step 7: Commit auth changes**

Run:

```bash
git add apps/api/src/features/admin-auth/admin-auth.module.ts apps/api/src/features/admin-auth/admin-auth.service.ts apps/api/src/features/admin-auth/admin-auth.controller.ts apps/api/src/features/admin-auth/admin-auth.service.spec.ts apps/api/src/features/admin-auth/admin-jwt.guard.spec.ts
git commit -m "feat(api): support company admin auth"
```

---

## Task 3: Admin Access Control Helpers

**Files:**
- Create: `apps/api/src/features/admin-auth/admin-access-control.service.ts`
- Create: `apps/api/src/features/admin-auth/super-admin.guard.ts`
- Create: `apps/api/src/features/admin-auth/admin-access-control.service.spec.ts`
- Modify: `apps/api/src/features/admin-auth/admin-auth.module.ts`

- [ ] **Step 1: Write failing access-control tests**

Create `apps/api/src/features/admin-auth/admin-access-control.service.spec.ts`:

```ts
import { ForbiddenException } from '@nestjs/common';
import { AdminAccessControlService } from './admin-access-control.service';

describe('AdminAccessControlService', () => {
  it('returns all scope filters for super admins', async () => {
    const service = createService();

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

  it('loads company admin scope as unique company and game ids', async () => {
    const service = createService([
      {
        companyId: 'company-1',
        gameIds: ['game-1', 'game-2'],
        operationCodes: ['company.read', 'game.read'],
      },
      {
        companyId: 'company-1',
        gameIds: ['game-2'],
        operationCodes: ['company.read'],
      },
    ]);

    await expect(
      service.resolveReadScope({
        adminId: 'company-admin-1',
        displayName: '公司管理员',
        role: 'COMPANY_ADMIN',
        username: 'company_admin',
      }),
    ).resolves.toEqual({
      companyIds: ['company-1'],
      gameAppIds: ['ks-game-1', 'ks-game-2'],
      gameIds: ['game-1', 'game-2'],
      isSuperAdmin: false,
    });
  });

  it('throws and records audit for company admin writes', async () => {
    const auditLog = { create: jest.fn(async (input) => input) };
    const service = createService([], auditLog);

    await expect(
      service.assertSuperAdmin(
        {
          adminId: 'company-admin-1',
          displayName: '公司管理员',
          role: 'COMPANY_ADMIN',
          username: 'company_admin',
        },
        {
          method: 'POST',
          path: '/api/admin/games',
        },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'permission.denied',
        actorId: 'company-admin-1',
        actorType: 'COMPANY_ADMIN',
        targetId: 'POST /api/admin/games',
        targetType: 'admin_route',
      }),
    });
  });
});

function createService(
  scopes: Array<{
    companyId: string;
    gameIds: string[];
    operationCodes: string[];
  }> = [],
  auditLog = { create: jest.fn(async (input) => input) },
) {
  return new AdminAccessControlService({
    auditLog,
    companyAdminScope: {
      findMany: jest.fn(async () => scopes),
    },
    game: {
      findMany: jest.fn(async () => [
        { gameAppId: 'ks-game-1', id: 'game-1' },
        { gameAppId: 'ks-game-2', id: 'game-2' },
      ]),
    },
  } as never);
}
```

- [ ] **Step 2: Run access-control test to verify it fails**

Run:

```bash
pnpm --filter api test -- admin-access-control.service.spec.ts
```

Expected: FAIL because the service does not exist.

- [ ] **Step 3: Implement access-control service**

Create `apps/api/src/features/admin-auth/admin-access-control.service.ts`:

```ts
import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  getAdminActorId,
  type AdminPrincipal,
} from './admin-auth.service';

type AdminAccessPrisma = Pick<
  PrismaService,
  'auditLog' | 'companyAdminScope' | 'game'
>;

export type AdminReadScope = {
  companyIds?: string[];
  gameAppIds?: string[];
  gameIds?: string[];
  isSuperAdmin: boolean;
};

export type AdminRequestContext = {
  method: string;
  path: string;
};

const READ_OPERATION_CODES = [
  'audit.read',
  'company.read',
  'ecpm.read',
  'game.read',
  'settlement.read',
  'withdrawal.read',
];

@Injectable()
export class AdminAccessControlService {
  constructor(
    @Inject(PrismaService) private readonly prisma: AdminAccessPrisma,
  ) {}

  async resolveReadScope(admin: AdminPrincipal): Promise<AdminReadScope> {
    if (admin.role === 'SUPER_ADMIN') {
      return {
        companyIds: undefined,
        gameAppIds: undefined,
        gameIds: undefined,
        isSuperAdmin: true,
      };
    }

    const scopes = await this.prisma.companyAdminScope.findMany({
      where: {
        companyAdminId: admin.adminId,
      },
    });
    const companyIds = unique(scopes.map((scope) => scope.companyId));
    const gameIds = unique(scopes.flatMap((scope) => scope.gameIds));
    const games = gameIds.length
      ? await this.prisma.game.findMany({
          select: {
            gameAppId: true,
            id: true,
          },
          where: {
            deletedAt: null,
            id: {
              in: gameIds,
            },
          },
        })
      : [];

    return {
      companyIds,
      gameAppIds: unique(games.map((game) => game.gameAppId)),
      gameIds: unique(games.map((game) => game.id)),
      isSuperAdmin: false,
    };
  }

  async assertSuperAdmin(
    admin: AdminPrincipal,
    context: AdminRequestContext,
  ): Promise<void> {
    if (admin.role === 'SUPER_ADMIN') {
      return;
    }

    await this.recordDenied(admin, context);
    throw new ForbiddenException('无权限访问该操作');
  }

  async recordDenied(
    admin: AdminPrincipal,
    context: AdminRequestContext,
  ): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        action: 'permission.denied',
        actorId: getAdminActorId(admin),
        actorType: admin.role,
        metadata: {
          method: context.method,
          path: context.path,
          reason: 'super_admin_required',
        } satisfies Prisma.InputJsonObject,
        targetId: `${context.method} ${context.path}`,
        targetType: 'admin_route',
      },
    });
  }

  hasOperation(scope: AdminReadScope, operationCode: string): boolean {
    if (scope.isSuperAdmin) {
      return true;
    }

    return READ_OPERATION_CODES.includes(operationCode);
  }
}

function unique(values: string[]) {
  return Array.from(new Set(values)).sort();
}
```

- [ ] **Step 4: Implement SuperAdminGuard**

Create `apps/api/src/features/admin-auth/super-admin.guard.ts`:

```ts
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AdminAccessControlService } from './admin-access-control.service';
import { type AdminRequest } from './admin-jwt.guard';

@Injectable()
export class SuperAdminGuard implements CanActivate {
  constructor(
    private readonly accessControlService: AdminAccessControlService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<
      AdminRequest & { method?: string; originalUrl?: string; url?: string }
    >();
    if (!request.admin) {
      throw new UnauthorizedException('请先登录管理员账号');
    }

    await this.accessControlService.assertSuperAdmin(request.admin, {
      method: request.method ?? 'UNKNOWN',
      path: request.originalUrl ?? request.url ?? 'unknown',
    });
    return true;
  }
}
```

- [ ] **Step 5: Export helpers from admin auth module**

Modify `apps/api/src/features/admin-auth/admin-auth.module.ts`:

```ts
import { AdminAccessControlService } from './admin-access-control.service';
import { SuperAdminGuard } from './super-admin.guard';

@Module({
  controllers: [AdminAuthController],
  exports: [
    AdminAccessControlService,
    AdminAuthService,
    AdminJwtGuard,
    SuperAdminGuard,
  ],
  imports: [JwtModule.register({}), PrismaModule],
  providers: [
    AdminAccessControlService,
    AdminAuthService,
    AdminJwtGuard,
    SuperAdminGuard,
  ],
})
export class AdminAuthModule {}
```

- [ ] **Step 6: Run access-control tests**

Run:

```bash
pnpm --filter api test -- admin-access-control.service.spec.ts
```

Expected: PASS.

- [ ] **Step 7: Commit access-control helpers**

Run:

```bash
git add apps/api/src/features/admin-auth/admin-access-control.service.ts apps/api/src/features/admin-auth/admin-access-control.service.spec.ts apps/api/src/features/admin-auth/super-admin.guard.ts apps/api/src/features/admin-auth/admin-auth.module.ts
git commit -m "feat(api): add admin access control helpers"
```

---

## Task 4: Company Admin Management API

**Files:**
- Create: `apps/api/src/features/company-admin/company-admin.module.ts`
- Create: `apps/api/src/features/company-admin/company-admin.service.ts`
- Create: `apps/api/src/features/company-admin/company-admin.controller.ts`
- Create: `apps/api/src/features/company-admin/company-admin.service.spec.ts`
- Create: `apps/api/src/features/company-admin/company-admin.controller.spec.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Write failing service tests**

Create `apps/api/src/features/company-admin/company-admin.service.spec.ts` with these cases:

```ts
import { ConflictException, NotFoundException } from '@nestjs/common';
import { compare } from 'bcryptjs';
import { CompanyAdminService } from './company-admin.service';

describe('CompanyAdminService', () => {
  it('creates company admin accounts with hashed passwords and audit logs', async () => {
    const prisma = createPrisma();
    const service = new CompanyAdminService(prisma as never);

    const admin = await service.createCompanyAdmin({
      actor: { role: 'SUPER_ADMIN', username: 'root' },
      displayName: '上海运营',
      enabled: true,
      password: 'companypass',
      username: 'company_admin',
    });

    expect(admin.username).toBe('company_admin');
    expect(admin.passwordHash).not.toBe('companypass');
    await expect(compare('companypass', admin.passwordHash)).resolves.toBe(true);
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'company_admin.created',
        actorId: 'root',
        actorType: 'SUPER_ADMIN',
        targetId: admin.id,
        targetType: 'company_admin',
      }),
    });
  });

  it('rejects duplicate usernames', async () => {
    const prisma = createPrisma();
    prisma.companyAdminAccount.create.mockRejectedValueOnce({ code: 'P2002' });
    const service = new CompanyAdminService(prisma as never);

    await expect(
      service.createCompanyAdmin({
        actor: { role: 'SUPER_ADMIN', username: 'root' },
        displayName: '上海运营',
        enabled: true,
        password: 'companypass',
        username: 'company_admin',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('replaces scopes with validated company games and read operations', async () => {
    const prisma = createPrisma();
    const service = new CompanyAdminService(prisma as never);

    await service.replaceScopes({
      actor: { role: 'SUPER_ADMIN', username: 'root' },
      adminId: 'company-admin-1',
      scopes: [{ companyId: 'company-1', gameIds: ['game-1'] }],
    });

    expect(prisma.$transaction).toHaveBeenCalled();
    expect(prisma.companyAdminScope.createMany).toHaveBeenCalledWith({
      data: [
        {
          companyAdminId: 'company-admin-1',
          companyId: 'company-1',
          gameIds: ['game-1'],
          operationCodes: [
            'company.read',
            'game.read',
            'settlement.read',
            'withdrawal.read',
            'ecpm.read',
            'audit.read',
          ],
        },
      ],
    });
  });
});
```

Use this fake factory in the same spec:

```ts
function createPrisma() {
  const tx = {
    auditLog: { create: jest.fn(async (input) => input) },
    company: {
      findUnique: jest.fn(async () => ({ deletedAt: null, id: 'company-1' })),
    },
    companyAdminAccount: {
      create: jest.fn(async ({ data }) => ({
        ...data,
        createdAt: new Date('2026-05-09T00:00:00.000Z'),
        deletedAt: null,
        id: 'company-admin-1',
        updatedAt: new Date('2026-05-09T00:00:00.000Z'),
      })),
      findUnique: jest.fn(async () => ({
        deletedAt: null,
        id: 'company-admin-1',
      })),
      update: jest.fn(async ({ data }) => ({
        deletedAt: null,
        displayName: data.displayName ?? '上海运营',
        enabled: data.enabled ?? true,
        id: 'company-admin-1',
        passwordHash: data.passwordHash ?? 'hash',
        username: 'company_admin',
      })),
    },
    companyAdminScope: {
      createMany: jest.fn(async () => ({ count: 1 })),
      deleteMany: jest.fn(async () => ({ count: 1 })),
      findMany: jest.fn(async () => []),
    },
    game: {
      findMany: jest.fn(async () => [
        {
          companyId: 'company-1',
          deletedAt: null,
          id: 'game-1',
          name: '测试游戏',
        },
      ]),
    },
  };
  return {
    ...tx,
    $transaction: jest.fn(async (callback) => callback(tx)),
  };
}
```

- [ ] **Step 2: Run service tests to verify they fail**

Run:

```bash
pnpm --filter api test -- company-admin.service.spec.ts
```

Expected: FAIL because `CompanyAdminService` does not exist.

- [ ] **Step 3: Implement company admin service**

Create `apps/api/src/features/company-admin/company-admin.service.ts`:

```ts
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { hash } from 'bcryptjs';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  getAdminActorId,
  type AdminPrincipal,
} from '../admin-auth/admin-auth.service';

type CompanyAdminPrisma = Pick<
  PrismaService,
  | '$transaction'
  | 'auditLog'
  | 'company'
  | 'companyAdminAccount'
  | 'companyAdminScope'
  | 'game'
>;

export const READ_ONLY_OPERATION_CODES = [
  'company.read',
  'game.read',
  'settlement.read',
  'withdrawal.read',
  'ecpm.read',
  'audit.read',
];

export type CreateCompanyAdminInput = {
  actor: AdminPrincipal;
  displayName: string;
  enabled?: boolean;
  password: string;
  username: string;
};

export type UpdateCompanyAdminInput = {
  actor: AdminPrincipal;
  adminId: string;
  displayName?: string;
  enabled?: boolean;
  password?: string;
};

export type ReplaceCompanyAdminScopesInput = {
  actor: AdminPrincipal;
  adminId: string;
  scopes: Array<{
    companyId: string;
    gameIds: string[];
  }>;
};

@Injectable()
export class CompanyAdminService {
  constructor(
    @Inject(PrismaService) private readonly prisma: CompanyAdminPrisma,
  ) {}

  listCompanyAdmins() {
    return this.prisma.companyAdminAccount.findMany({
      include: {
        scopes: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
      where: {
        deletedAt: null,
      },
    });
  }

  async createCompanyAdmin(input: CreateCompanyAdminInput) {
    try {
      const admin = await this.prisma.companyAdminAccount.create({
        data: {
          displayName: input.displayName,
          enabled: input.enabled ?? true,
          passwordHash: await hash(input.password, 10),
          username: input.username,
        },
      });

      await this.recordAudit(input.actor, {
        action: 'company_admin.created',
        metadata: {
          displayName: admin.displayName,
          enabled: admin.enabled,
          username: admin.username,
        },
        targetId: admin.id,
      });

      return admin;
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException('公司管理员用户名已存在');
      }

      throw error;
    }
  }

  async updateCompanyAdmin(input: UpdateCompanyAdminInput) {
    const current = await this.findCompanyAdminOrThrow(input.adminId);
    const data: {
      displayName?: string;
      enabled?: boolean;
      passwordHash?: string;
    } = {};

    if (input.displayName !== undefined) {
      data.displayName = input.displayName;
    }
    if (input.enabled !== undefined) {
      data.enabled = input.enabled;
    }
    if (input.password !== undefined) {
      data.passwordHash = await hash(input.password, 10);
    }
    if (Object.keys(data).length === 0) {
      throw new BadRequestException('Company admin update is invalid');
    }

    const updated = await this.prisma.companyAdminAccount.update({
      data,
      where: {
        id: current.id,
      },
    });

    await this.recordAudit(input.actor, {
      action: 'company_admin.updated',
      metadata: {
        changedFields: Object.keys(data),
        username: updated.username,
      },
      targetId: updated.id,
    });

    return updated;
  }

  async replaceScopes(input: ReplaceCompanyAdminScopesInput) {
    await this.findCompanyAdminOrThrow(input.adminId);
    return this.prisma.$transaction(async (tx) => {
      for (const scope of input.scopes) {
        const company = await tx.company.findUnique({
          where: { id: scope.companyId },
        });
        if (!company || company.deletedAt) {
          throw new NotFoundException(`Company ${scope.companyId} is not found`);
        }

        const games = await tx.game.findMany({
          where: {
            companyId: scope.companyId,
            deletedAt: null,
            id: { in: scope.gameIds },
          },
        });
        if (games.length !== new Set(scope.gameIds).size) {
          throw new BadRequestException('Company admin scope games are invalid');
        }
      }

      await tx.companyAdminScope.deleteMany({
        where: {
          companyAdminId: input.adminId,
        },
      });
      await tx.companyAdminScope.createMany({
        data: input.scopes.map((scope) => ({
          companyAdminId: input.adminId,
          companyId: scope.companyId,
          gameIds: unique(scope.gameIds),
          operationCodes: READ_ONLY_OPERATION_CODES,
        })),
      });
      await tx.auditLog.create({
        data: {
          action: 'company_admin.scopes_updated',
          actorId: getAdminActorId(input.actor),
          actorType: input.actor.role,
          metadata: {
            scopes: input.scopes.map((scope) => ({
              companyId: scope.companyId,
              gameIds: unique(scope.gameIds),
            })),
          } satisfies Prisma.InputJsonObject,
          targetId: input.adminId,
          targetType: 'company_admin',
        },
      });

      return this.prisma.companyAdminAccount.findUnique({
        include: {
          scopes: true,
        },
        where: {
          id: input.adminId,
        },
      });
    });
  }

  private async findCompanyAdminOrThrow(adminId: string) {
    const admin = await this.prisma.companyAdminAccount.findUnique({
      where: {
        id: adminId,
      },
    });
    if (!admin || admin.deletedAt) {
      throw new NotFoundException(`Company admin ${adminId} is not found`);
    }

    return admin;
  }

  private recordAudit(
    actor: AdminPrincipal,
    input: {
      action: string;
      metadata: Prisma.InputJsonObject;
      targetId: string;
    },
  ) {
    return this.prisma.auditLog.create({
      data: {
        action: input.action,
        actorId: getAdminActorId(actor),
        actorType: actor.role,
        metadata: input.metadata,
        targetId: input.targetId,
        targetType: 'company_admin',
      },
    });
  }
}

function unique(values: string[]) {
  return Array.from(new Set(values)).sort();
}

function isUniqueConstraintError(error: unknown) {
  return (
    error !== null &&
    typeof error === 'object' &&
    'code' in error &&
    error.code === 'P2002'
  );
}
```

- [ ] **Step 4: Implement controller and module**

Create `apps/api/src/features/company-admin/company-admin.controller.ts`:

```ts
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Put,
  Post,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import { AdminJwtGuard } from '../admin-auth/admin-jwt.guard';
import { CurrentAdmin } from '../admin-auth/current-admin.decorator';
import { type AdminPrincipal } from '../admin-auth/admin-auth.service';
import { SuperAdminGuard } from '../admin-auth/super-admin.guard';
import { CompanyAdminService } from './company-admin.service';

const idSchema = z.string().trim().min(1);
const passwordSchema = z.string().min(8);

const createCompanyAdminSchema = z.object({
  displayName: z.string().trim().min(1),
  enabled: z.boolean().optional(),
  password: passwordSchema,
  username: z.string().trim().min(1),
});

const updateCompanyAdminSchema = z.object({
  displayName: z.string().trim().min(1).optional(),
  enabled: z.boolean().optional(),
  password: passwordSchema.optional(),
});

const scopeSchema = z.object({
  scopes: z.array(
    z.object({
      companyId: idSchema,
      gameIds: z.array(idSchema),
    }),
  ),
});

@Controller('admin/company-admins')
@UseGuards(AdminJwtGuard, SuperAdminGuard)
export class CompanyAdminController {
  constructor(private readonly companyAdminService: CompanyAdminService) {}

  @Get()
  async list() {
    const admins = await this.companyAdminService.listCompanyAdmins();
    return {
      admins: admins.map(presentCompanyAdmin),
    };
  }

  @Post()
  async create(@CurrentAdmin() admin: AdminPrincipal, @Body() body: unknown) {
    const input = parseBody(
      createCompanyAdminSchema,
      body,
      'Company admin input is invalid',
    );
    const companyAdmin = await this.companyAdminService.createCompanyAdmin({
      actor: admin,
      displayName: input.displayName,
      enabled: input.enabled,
      password: input.password,
      username: input.username,
    });
    return {
      admin: presentCompanyAdmin(companyAdmin),
    };
  }

  @Patch(':adminId')
  async update(
    @CurrentAdmin() admin: AdminPrincipal,
    @Param('adminId') adminId: string,
    @Body() body: unknown,
  ) {
    const input = parseBody(
      updateCompanyAdminSchema,
      body,
      'Company admin update is invalid',
    );
    if (
      input.displayName === undefined &&
      input.enabled === undefined &&
      input.password === undefined
    ) {
      throw new BadRequestException('Company admin update is invalid');
    }

    const companyAdmin = await this.companyAdminService.updateCompanyAdmin({
      actor: admin,
      adminId: parseId(adminId),
      displayName: input.displayName,
      enabled: input.enabled,
      password: input.password,
    });
    return {
      admin: presentCompanyAdmin(companyAdmin),
    };
  }

  @Put(':adminId/scopes')
  async replaceScopes(
    @CurrentAdmin() admin: AdminPrincipal,
    @Param('adminId') adminId: string,
    @Body() body: unknown,
  ) {
    const input = parseBody(scopeSchema, body, 'Company admin scope is invalid');
    const companyAdmin = await this.companyAdminService.replaceScopes({
      actor: admin,
      adminId: parseId(adminId),
      scopes: input.scopes,
    });
    return {
      admin: presentCompanyAdmin(companyAdmin),
    };
  }
}

function parseBody<T extends z.ZodTypeAny>(
  schema: T,
  body: unknown,
  message: string,
): z.infer<T> {
  const parsed = schema.safeParse(body ?? {});
  if (!parsed.success) {
    throw new BadRequestException(message);
  }

  return parsed.data;
}

function parseId(value: string) {
  const parsed = idSchema.safeParse(value);
  if (!parsed.success) {
    throw new BadRequestException('Company admin id is invalid');
  }

  return parsed.data;
}

function presentCompanyAdmin(admin: {
  createdAt?: Date;
  displayName: string;
  enabled: boolean;
  id: string;
  scopes?: Array<{
    companyId: string;
    gameIds: string[];
    operationCodes: string[];
  }>;
  updatedAt?: Date;
  username: string;
}) {
  return {
    createdAt: admin.createdAt?.toISOString() ?? null,
    displayName: admin.displayName,
    enabled: admin.enabled,
    id: admin.id,
    scopes:
      admin.scopes?.map((scope) => ({
        companyId: scope.companyId,
        gameIds: scope.gameIds,
        operationCodes: scope.operationCodes,
      })) ?? [],
    updatedAt: admin.updatedAt?.toISOString() ?? null,
    username: admin.username,
  };
}
```

Create `apps/api/src/features/company-admin/company-admin.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { AdminAuthModule } from '../admin-auth/admin-auth.module';
import { CompanyAdminController } from './company-admin.controller';
import { CompanyAdminService } from './company-admin.service';

@Module({
  controllers: [CompanyAdminController],
  imports: [AdminAuthModule, PrismaModule],
  providers: [CompanyAdminService],
})
export class CompanyAdminModule {}
```

- [ ] **Step 5: Import the module in app module**

Modify `apps/api/src/app.module.ts` to import and include:

```ts
import { CompanyAdminModule } from './features/company-admin/company-admin.module';

// in imports array:
CompanyAdminModule,
```

- [ ] **Step 6: Add controller tests**

Create `apps/api/src/features/company-admin/company-admin.controller.spec.ts`:

```ts
import { BadRequestException } from '@nestjs/common';
import { CompanyAdminController } from './company-admin.controller';

describe('CompanyAdminController', () => {
  it('rejects short passwords', async () => {
    const controller = new CompanyAdminController({
      createCompanyAdmin: jest.fn(),
    } as never);

    await expect(
      controller.create(
        { role: 'SUPER_ADMIN', username: 'root' },
        {
          displayName: '上海运营',
          password: 'short',
          username: 'company_admin',
        },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('passes scope replacement input to the service', async () => {
    const service = {
      replaceScopes: jest.fn(async () => ({
        createdAt: new Date('2026-05-09T00:00:00.000Z'),
        displayName: '上海运营',
        enabled: true,
        id: 'company-admin-1',
        scopes: [
          {
            companyId: 'company-1',
            gameIds: ['game-1'],
            operationCodes: ['company.read'],
          },
        ],
        updatedAt: new Date('2026-05-09T00:00:00.000Z'),
        username: 'company_admin',
      })),
    };
    const controller = new CompanyAdminController(service as never);

    await controller.replaceScopes(
      { role: 'SUPER_ADMIN', username: 'root' },
      'company-admin-1',
      { scopes: [{ companyId: 'company-1', gameIds: ['game-1'] }] },
    );

    expect(service.replaceScopes).toHaveBeenCalledWith({
      actor: { role: 'SUPER_ADMIN', username: 'root' },
      adminId: 'company-admin-1',
      scopes: [{ companyId: 'company-1', gameIds: ['game-1'] }],
    });
  });
});
```

- [ ] **Step 7: Run company-admin API tests**

Run:

```bash
pnpm --filter api test -- company-admin
```

Expected: PASS.

- [ ] **Step 8: Commit company-admin management API**

Run:

```bash
git add apps/api/src/features/company-admin apps/api/src/app.module.ts
git commit -m "feat(api): add company admin management"
```

---

## Task 5: Scope Existing Admin Read and Write Routes

**Files:**
- Modify: `apps/api/src/features/admin-resources/admin-resources.controller.ts`
- Modify: `apps/api/src/features/admin-resources/admin-resources.service.ts`
- Modify: `apps/api/src/features/admin-resources/admin-resources.service.spec.ts`
- Modify: `apps/api/src/features/settlement-admin/settlement-admin.controller.ts`
- Modify: `apps/api/src/features/settlement-admin/settlement-admin.service.ts`
- Modify: `apps/api/src/features/settlement-admin/settlement-admin.service.spec.ts`
- Modify: `apps/api/src/features/kuaishou-admin/kuaishou-refresh.controller.ts`
- Modify: `apps/api/src/features/kuaishou-admin/kuaishou-ecpm-sync-job.service.ts`
- Modify: `apps/api/src/features/kuaishou-admin/kuaishou-ecpm-sync-job.service.spec.ts`
- Modify: `apps/api/src/features/kuaishou-admin/kuaishou-token.controller.ts`
- Modify: `apps/api/src/features/audit/audit-log.controller.ts`
- Modify: `apps/api/src/features/audit/audit-log.service.ts`
- Modify: `apps/api/src/features/audit/audit-log.service.spec.ts`
- Modify: `apps/api/src/features/withdrawal-admin/withdrawal-review.controller.ts`
- Modify: `apps/api/src/features/withdrawal-admin/withdrawal-review.service.ts`
- Modify: `apps/api/src/features/withdrawal-admin/withdrawal-detail.service.ts`
- Modify related specs under `apps/api/src/features/withdrawal-admin/`

- [ ] **Step 1: Write failing admin resource filtering tests**

In `apps/api/src/features/admin-resources/admin-resources.service.spec.ts`, add tests that call `listCompanies({ admin })` and `listGames({ admin })` with a company-admin principal. Use a fake `AdminAccessControlService` returning:

```ts
{
  companyIds: ['company-1'],
  gameAppIds: ['ks-game-1'],
  gameIds: ['game-1'],
  isSuperAdmin: false,
}
```

Expected behavior:

```ts
expect(prisma.company.findMany).toHaveBeenCalledWith(
  expect.objectContaining({
    where: {
      deletedAt: null,
      games: {
        some: {
          deletedAt: null,
          id: { in: ['game-1'] },
        },
      },
      id: { in: ['company-1'] },
    },
  }),
);

expect(prisma.game.findMany).toHaveBeenCalledWith(
  expect.objectContaining({
    where: {
      deletedAt: null,
      id: { in: ['game-1'] },
    },
  }),
);
```

- [ ] **Step 2: Run admin resource tests to verify they fail**

Run:

```bash
pnpm --filter api test -- admin-resources.service.spec.ts
```

Expected: FAIL because `listCompanies` and `listGames` do not accept principals or scope.

- [ ] **Step 3: Implement admin resource scope filtering**

Modify `AdminResourcesService` constructor to inject `AdminAccessControlService`:

```ts
constructor(
  @Inject(PrismaService) private readonly prisma: AdminResourcesPrisma,
  private readonly accessControlService: AdminAccessControlService,
  @Optional()
  @Inject(ADMIN_RESOURCES_NOW)
  private readonly nowProvider: () => Date = () => new Date(),
) {}
```

Change inputs:

```ts
export type ListCompaniesInput = {
  admin: AdminPrincipal;
};

export type ListGamesInput = {
  admin: AdminPrincipal;
  companyId?: string;
};
```

Update `listCompanies`:

```ts
async listCompanies(input: ListCompaniesInput) {
  const scope = await this.accessControlService.resolveReadScope(input.admin);
  return this.prisma.company.findMany({
    orderBy: { createdAt: 'asc' },
    where: {
      deletedAt: null,
      ...(scope.isSuperAdmin
        ? {}
        : {
            games: {
              some: {
                deletedAt: null,
                id: { in: scope.gameIds ?? [] },
              },
            },
            id: { in: scope.companyIds ?? [] },
          }),
    },
  });
}
```

Update `listGames`:

```ts
async listGames(input: ListGamesInput) {
  const scope = await this.accessControlService.resolveReadScope(input.admin);
  return this.prisma.game.findMany({
    include: { company: true },
    orderBy: { createdAt: 'asc' },
    where: {
      ...(input.companyId ? { companyId: input.companyId } : {}),
      deletedAt: null,
      ...(scope.isSuperAdmin ? {} : { id: { in: scope.gameIds ?? [] } }),
    },
  });
}
```

Update `AdminResourcesController`:

```ts
  @Get('admin/companies')
  async listCompanies(@CurrentAdmin() admin: AdminPrincipal) {
    const companies = await this.adminResourcesService.listCompanies({ admin });
    return { companies: companies.map(presentCompany) };
  }

  @Get('admin/games')
  async listGames(@CurrentAdmin() admin: AdminPrincipal, @Query() query: unknown) {
    const input = parseBody(gameListQuerySchema, query ?? {}, 'Game list query is invalid');
    const games = await this.adminResourcesService.listGames({
      admin,
      companyId: input.companyId,
    });
    return { games: games.map(presentGame) };
  }
```

Add `SuperAdminGuard` to write routes:

```ts
@Post('admin/companies')
@UseGuards(SuperAdminGuard)
```

Apply the same `@UseGuards(SuperAdminGuard)` decorator to:

- `POST admin/companies/:companyId/balance-adjustments`
- `POST admin/games`
- `PATCH admin/games/:gameId`
- `POST admin/games/:gameId/budget-allocations`

- [ ] **Step 4: Scope settlement list/detail and write routes**

In `SettlementAdminController`:

```ts
  @Get('preview')
  @UseGuards(SuperAdminGuard)
```

Add `@UseGuards(SuperAdminGuard)` to `POST confirm`.

Pass admin to list/detail:

```ts
  @Get()
  async list(@CurrentAdmin() admin: AdminPrincipal, @Query() query: unknown) {
    const input = parseSettlementListQuery(query);
    const batches = await this.settlementAdminService.listBatches({
      admin,
      gameId: input.gameId,
    });
    return { batches: batches.map(presentSettlementBatch) };
  }

  @Get(':batchId')
  async detail(@CurrentAdmin() admin: AdminPrincipal, @Param('batchId') batchId: string) {
    const batch = await this.settlementAdminService.getBatch({ admin, batchId });
    return {
      batch: presentSettlementBatch(batch),
      items: batch.items.map(presentSettlementItem),
    };
  }
```

In `SettlementAdminService`, inject `AdminAccessControlService` and implement:

```ts
type ListSettlementBatchesInput = {
  admin: AdminPrincipal;
  gameId?: string;
};

type GetSettlementBatchInput = {
  admin: AdminPrincipal;
  batchId: string;
};

async listBatches(input: ListSettlementBatchesInput) {
  const scope = await this.accessControlService.resolveReadScope(input.admin);
  return this.prisma.settlementBatch.findMany({
    include: { items: true },
    orderBy: { createdAt: 'desc' },
    take: 20,
    where: {
      ...(input.gameId ? { gameId: input.gameId } : {}),
      ...(scope.isSuperAdmin ? {} : { gameId: { in: scope.gameIds ?? [] } }),
    },
  }) as Promise<SettlementBatchWithItems[]>;
}

async getBatch(input: GetSettlementBatchInput) {
  const scope = await this.accessControlService.resolveReadScope(input.admin);
  const batch = await this.prisma.settlementBatch.findUnique({
    include: { items: true },
    where: { id: input.batchId },
  });
  if (!batch) {
    throw new NotFoundException(`Settlement batch ${input.batchId} is not found`);
  }
  if (!scope.isSuperAdmin && !(scope.gameIds ?? []).includes(batch.gameId)) {
    throw new ForbiddenException('无权限访问该操作');
  }
  return batch as SettlementBatchWithItems;
}
```

- [ ] **Step 5: Scope ECPM jobs and token endpoints**

Update `KuaishouEcpmSyncJobService` input:

```ts
export type ListKuaishouEcpmSyncJobsInput = {
  gameAppId?: string;
  gameAppIds?: string[];
  limit?: number;
};
```

Update `listJobs`:

```ts
listJobs(input: ListKuaishouEcpmSyncJobsInput = {}) {
  return this.prisma.kuaishouEcpmSyncJob.findMany({
    orderBy: { createdAt: 'desc' },
    take: clampLimit(input.limit),
    where: {
      ...(input.gameAppId ? { gameAppId: input.gameAppId } : {}),
      ...(input.gameAppIds ? { gameAppId: { in: input.gameAppIds } } : {}),
    },
  });
}
```

In `KuaishouRefreshController`, inject `AdminAccessControlService`, add `@UseGuards(SuperAdminGuard)` to `POST ecpm/refresh`, and filter jobs:

```ts
  @Get('ecpm/jobs')
  async jobs(
    @CurrentAdmin() admin: AdminPrincipal,
    @Query('limit') limit?: string,
    @Query('gameAppId') gameAppId?: string,
  ) {
    const scope = await this.accessControlService.resolveReadScope(admin);
    const allowedGameAppIds = scope.isSuperAdmin ? undefined : scope.gameAppIds ?? [];
    const jobs = await this.syncJobService.listJobs({
      gameAppId,
      gameAppIds: allowedGameAppIds,
      limit: parseLimit(limit),
    });

    return { jobs: jobs.map(presentKuaishouEcpmSyncJob) };
  }
```

In `KuaishouTokenController`, add `@UseGuards(AdminJwtGuard, SuperAdminGuard)` at the class level.

- [ ] **Step 6: Scope audit logs**

Change `AuditLogController.list` to:

```ts
  @Get()
  async list(@CurrentAdmin() admin: AdminPrincipal, @Query('limit') limit?: string) {
    const rows = await this.auditLogService.list({
      admin,
      limit: limit ? Number(limit) : undefined,
    });
    return { logs: rows.map(presentAuditLog) };
  }
```

Update `AuditLogService` input and implementation:

```ts
export type ListAuditLogsInput = {
  admin: AdminPrincipal;
  limit?: number;
};

async list(input: ListAuditLogsInput) {
  const scope = await this.accessControlService.resolveReadScope(input.admin);
  if (scope.isSuperAdmin) {
    return this.prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(input.limit ?? 50, 1), 100),
    });
  }

  return this.prisma.auditLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: Math.min(Math.max(input.limit ?? 50, 1), 100),
    where: {
      OR: [
        { targetType: 'company', targetId: { in: scope.companyIds ?? [] } },
        { targetType: 'game', targetId: { in: scope.gameIds ?? [] } },
      ],
    },
  });
}
```

This MVP intentionally returns only logs whose `targetType` and `targetId` can be scoped directly to an authorized company or game. Do not include ambiguous JSON metadata filters in this task.

- [ ] **Step 7: Lock down withdrawal routes**

In `WithdrawalReviewController`, add `@UseGuards(SuperAdminGuard)` to:

- `POST :batchId/approve`
- `POST :batchId/pay`
- `POST :batchId/close`

Pass admin to read methods:

```ts
  @Get()
  async list(@CurrentAdmin() admin: AdminPrincipal, @Query('status') status?: string) {
    const batches = await this.withdrawalReviewService.listBatches({
      admin,
      status: status?.trim() || undefined,
    });
    return { batches: batches.map(presentWithdrawalBatch) };
  }

  @Get(':batchId')
  async detail(@CurrentAdmin() admin: AdminPrincipal, @Param('batchId') batchId: string) {
    const detail = await this.withdrawalDetailService.getBatchDetail({
      admin,
      batchId,
    });
    return presentWithdrawalDetail(detail);
  }
```

In `WithdrawalReviewService`:

```ts
export type ListWithdrawalBatchesInput = {
  admin: AdminPrincipal;
  status?: string;
};

async listBatches(input: ListWithdrawalBatchesInput = {} as never) {
  if (input.admin.role === 'COMPANY_ADMIN') {
    return [];
  }
  // existing findMany for super admin
}
```

In `WithdrawalDetailService`:

```ts
export type GetWithdrawalBatchDetailInput = {
  admin: AdminPrincipal;
  batchId: string;
};

if (input.admin.role === 'COMPANY_ADMIN') {
  throw new ForbiddenException('无权限访问该操作');
}
```

- [ ] **Step 8: Run scoped API tests**

Run:

```bash
pnpm --filter api test -- admin-resources settlement-admin kuaishou-refresh kuaishou-ecpm-sync-job audit-log withdrawal
```

Expected: PASS.

- [ ] **Step 9: Commit scoped routes**

Run:

```bash
git add apps/api/src/features/admin-resources apps/api/src/features/settlement-admin apps/api/src/features/kuaishou-admin apps/api/src/features/audit apps/api/src/features/withdrawal-admin
git commit -m "feat(api): scope company admin read access"
```

---

## Task 6: Web API Types and Client

**Files:**
- Modify: `apps/web/src/types/api.ts`
- Modify: `apps/web/src/lib/aiKsApi.ts`
- Modify: `apps/web/src/lib/aiKsApi.test.ts`

- [ ] **Step 1: Write failing client tests**

In `apps/web/src/lib/aiKsApi.test.ts`, add:

```ts
it('loads current admin principal with the admin token', async () => {
  mockJsonResponse({
    admin: {
      adminId: 'company-admin-1',
      displayName: '上海运营',
      role: 'COMPANY_ADMIN',
      username: 'company_admin',
    },
  });

  await aiKsApi.getCurrentAdmin('admin-token');

  expect(fetchMock).toHaveBeenCalledWith(
    `${API_BASE_URL}/admin/auth/me`,
    expect.objectContaining({
      headers: expect.objectContaining({
        Authorization: 'Bearer admin-token',
      }),
    }),
  );
});

it('manages company admins through super admin endpoints', async () => {
  mockJsonResponse({ admins: [] });
  await aiKsApi.getCompanyAdmins('admin-token');
  expect(fetchMock).toHaveBeenLastCalledWith(
    `${API_BASE_URL}/admin/company-admins`,
    expect.any(Object),
  );

  mockJsonResponse({ admin: { id: 'company-admin-1' } });
  await aiKsApi.createCompanyAdmin('admin-token', {
    displayName: '上海运营',
    password: 'companypass',
    username: 'company_admin',
  });
  expect(fetchMock).toHaveBeenLastCalledWith(
    `${API_BASE_URL}/admin/company-admins`,
    expect.objectContaining({ method: 'POST' }),
  );

  mockJsonResponse({ admin: { id: 'company-admin-1' } });
  await aiKsApi.updateCompanyAdminScopes('admin-token', 'company-admin-1', {
    scopes: [{ companyId: 'company-1', gameIds: ['game-1'] }],
  });
  expect(fetchMock).toHaveBeenLastCalledWith(
    `${API_BASE_URL}/admin/company-admins/company-admin-1/scopes`,
    expect.objectContaining({ method: 'PUT' }),
  );
});
```

- [ ] **Step 2: Run web client tests to verify they fail**

Run:

```bash
pnpm --filter web test -- aiKsApi.test.ts
```

Expected: FAIL because the new types and client methods do not exist.

- [ ] **Step 3: Add API types**

In `apps/web/src/types/api.ts`, replace `AdminAuthResult` admin shape with:

```ts
export type SuperAdminPrincipal = {
  role: 'SUPER_ADMIN';
  username: string;
};

export type CompanyAdminPrincipal = {
  adminId: string;
  displayName: string;
  role: 'COMPANY_ADMIN';
  username: string;
};

export type AdminPrincipal = CompanyAdminPrincipal | SuperAdminPrincipal;

export type AdminAuthResult = {
  accessToken: string;
  admin: AdminPrincipal;
};

export type CurrentAdminResult = {
  admin: AdminPrincipal;
};
```

Add company-admin management types:

```ts
export type AdminCompanyAdminScope = {
  companyId: string;
  gameIds: string[];
  operationCodes: string[];
};

export type AdminCompanyAdmin = {
  createdAt: string | null;
  displayName: string;
  enabled: boolean;
  id: string;
  scopes: AdminCompanyAdminScope[];
  updatedAt: string | null;
  username: string;
};

export type AdminCompanyAdminListResult = {
  admins: AdminCompanyAdmin[];
};

export type AdminCompanyAdminResult = {
  admin: AdminCompanyAdmin;
};
```

- [ ] **Step 4: Add API client methods**

In `apps/web/src/lib/aiKsApi.ts`, import the new types and add:

```ts
function companyAdminPath(adminId: string, suffix = '') {
  return `/admin/company-admins/${encodeURIComponent(adminId)}${suffix}`;
}
```

Add methods inside `aiKsApi`:

```ts
  getCurrentAdmin(adminAccessToken: string) {
    return requestJson<CurrentAdminResult>('/admin/auth/me', {
      accessToken: adminAccessToken,
    });
  },

  getCompanyAdmins(adminAccessToken: string) {
    return requestJson<AdminCompanyAdminListResult>('/admin/company-admins', {
      accessToken: adminAccessToken,
    });
  },

  createCompanyAdmin(
    adminAccessToken: string,
    payload: {
      displayName: string;
      enabled?: boolean;
      password: string;
      username: string;
    },
  ) {
    return requestJson<AdminCompanyAdminResult>('/admin/company-admins', {
      accessToken: adminAccessToken,
      body: payload,
      method: 'POST',
    });
  },

  updateCompanyAdmin(
    adminAccessToken: string,
    adminId: string,
    payload: {
      displayName?: string;
      enabled?: boolean;
      password?: string;
    },
  ) {
    return requestJson<AdminCompanyAdminResult>(companyAdminPath(adminId), {
      accessToken: adminAccessToken,
      body: payload,
      method: 'PATCH',
    });
  },

  updateCompanyAdminScopes(
    adminAccessToken: string,
    adminId: string,
    payload: {
      scopes: Array<{
        companyId: string;
        gameIds: string[];
      }>;
    },
  ) {
    return requestJson<AdminCompanyAdminResult>(
      companyAdminPath(adminId, '/scopes'),
      {
        accessToken: adminAccessToken,
        body: payload,
        method: 'PUT',
      },
    );
  },
```

- [ ] **Step 5: Run focused web tests**

Run:

```bash
pnpm --filter web test -- aiKsApi.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit web client types**

Run:

```bash
git add apps/web/src/types/api.ts apps/web/src/lib/aiKsApi.ts apps/web/src/lib/aiKsApi.test.ts
git commit -m "feat(web): add company admin api client"
```

---

## Task 7: Web Session and Role-Aware App Loading

**Files:**
- Modify: `apps/web/src/app/session.ts`
- Modify: `apps/web/src/app/session.test.ts`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/pages/pages.test.tsx`

- [ ] **Step 1: Write failing session tests**

In `apps/web/src/app/session.test.ts`, add:

```ts
it('keeps operations visible for company admin sessions', () => {
  expect(
    getVisibleNavItems({
      accessToken: 'admin-token',
      admin: {
        adminId: 'company-admin-1',
        displayName: '上海运营',
        role: 'COMPANY_ADMIN',
        username: 'company_admin',
      },
      mode: 'admin',
    }).map((item) => item.key),
  ).toEqual(['query', 'operations']);
});
```

- [ ] **Step 2: Run session tests to verify they fail**

Run:

```bash
pnpm --filter web test -- session.test.ts
```

Expected: FAIL because admin sessions do not store `admin`.

- [ ] **Step 3: Update session type**

Modify `apps/web/src/app/session.ts`:

```ts
import type { AccountResult, AdminPrincipal } from '../types/api';

export type AppSession =
  | { mode: 'signed-out' }
  | { mode: 'guest' }
  | { accessToken: string; account: AccountResult; mode: 'account' }
  | { accessToken: string; admin: AdminPrincipal; mode: 'admin' };
```

- [ ] **Step 4: Update App admin state helpers**

In `apps/web/src/App.tsx`, import `AdminPrincipal` and add:

```ts
function getAdminDisplayName(admin: AdminPrincipal) {
  return admin.role === 'COMPANY_ADMIN' ? admin.displayName : admin.username;
}

function isSuperAdmin(admin?: AdminPrincipal) {
  return admin?.role === 'SUPER_ADMIN';
}
```

Add state:

```ts
const [currentAdmin, setCurrentAdmin] = useState<AdminPrincipal>();
```

Update `loginAdmin()` success:

```ts
setCurrentAdmin(result.admin);
setAdminName(getAdminDisplayName(result.admin));
setAppSession({
  accessToken: result.accessToken,
  admin: result.admin,
  mode: 'admin',
});
```

Update token restore flow:

```ts
if (adminAccessToken) {
  const tokenSessionVersion = sessionVersionRef.current;
  void restoreAdminSession(adminAccessToken, () =>
    isCurrentSessionVersion(tokenSessionVersion),
  );
}

async function restoreAdminSession(token: string, isCurrent = () => true) {
  try {
    const result = await aiKsApi.getCurrentAdmin(token);
    if (!isCurrent()) return;
    setCurrentAdmin(result.admin);
    setAdminName(getAdminDisplayName(result.admin));
    setAppSession({ accessToken: token, admin: result.admin, mode: 'admin' });
    setActiveView('operations');
    await loadAdminResourcesForToken(token, isCurrent, result.admin);
  } catch (nextError) {
    if (nextError instanceof ApiError && nextError.status === 401) {
      clearAdminAuth();
    }
  }
}
```

Update `clearAdminAuth()` and full logout to reset:

```ts
setCurrentAdmin(undefined);
```

Update `loadAdminResourcesForToken` signature:

```ts
async function loadAdminResourcesForToken(
  token: string,
  isCurrent = () => true,
  admin = currentAdmin,
) {
  const [companyResult, gameResult] = await Promise.all([
    aiKsApi.getAdminCompanies(token),
    aiKsApi.getAdminGames(token),
  ]);
  if (!isCurrent()) return false;
  applyAdminResources(companyResult.companies, gameResult.games);

  if (isSuperAdmin(admin)) {
    await Promise.allSettled([
      loadKuaishouTokenStatus(token, isCurrent),
      loadCompanyAdmins(token, isCurrent),
    ]);
  }
  await Promise.allSettled([
    loadKuaishouEcpmJobs(token, isCurrent),
    loadSettlementBatches(token, undefined, isCurrent),
    loadAdminWithdrawals(undefined, token, isCurrent),
    loadAuditLogs(token, isCurrent),
  ]);
  return true;
}
```

When editing the existing `App.tsx` functions, preserve the current request-version guards and `isCurrentSessionVersion` checks already used in the file.

- [ ] **Step 5: Gate write action handlers**

For write handlers such as `createAdminCompany`, `adjustCompanyBalance`, `createAdminGame`, `allocateGameBudget`, `saveGameConfig`, `refreshEcpm`, `authorizeKuaishouToken`, `refreshKuaishouToken`, `previewSettlement`, `confirmSettlement`, `approveAdminWithdrawal`, `payAdminWithdrawal`, and `closeAdminWithdrawal`, start with:

```ts
if (!isSuperAdmin(currentAdmin)) {
  setError('无权限访问该操作');
  return;
}
```

Keep backend guards as the security boundary; this client gate only avoids a bad company-admin experience.

- [ ] **Step 6: Run focused web tests**

Run:

```bash
pnpm --filter web test -- session.test.ts pages.test.tsx
```

Expected: PASS after updating affected fixtures to include `admin`.

- [ ] **Step 7: Commit session/app role changes**

Run:

```bash
git add apps/web/src/app/session.ts apps/web/src/app/session.test.ts apps/web/src/App.tsx apps/web/src/pages/pages.test.tsx
git commit -m "feat(web): support company admin sessions"
```

---

## Task 8: Operations Workspace Read-Only UI and Company Admin Panel

**Files:**
- Modify: `apps/web/src/pages/OperationsWorkspace.tsx`
- Modify: `apps/web/src/pages/pages.test.tsx`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/types/api.ts`

- [ ] **Step 1: Write failing OperationsWorkspace tests**

In `apps/web/src/pages/pages.test.tsx`, add:

```tsx
it('renders company admin operations as read-only', () => {
  const html = renderToStaticMarkup(
    <OperationsWorkspace
      {...operationsWorkspaceProps({
        currentAdmin: {
          adminId: 'company-admin-1',
          displayName: '上海运营',
          role: 'COMPANY_ADMIN',
          username: 'company_admin',
        },
      })}
    />,
  );

  expect(html).toContain('公司管理员');
  expect(html).toContain('只读权限');
  expect(html).not.toContain('创建公司');
  expect(html).not.toContain('确认结算');
  expect(html).not.toContain('刷新 token');
  expect(html).not.toContain('保存配置');
});

it('renders company admin management for super admins', () => {
  const html = renderToStaticMarkup(
    <OperationsWorkspace
      {...operationsWorkspaceProps({
        companyAdmins: [
          {
            createdAt: '2026-05-09T00:00:00.000Z',
            displayName: '上海运营',
            enabled: true,
            id: 'company-admin-1',
            scopes: [
              {
                companyId: 'company-1',
                gameIds: ['game-1'],
                operationCodes: ['company.read'],
              },
            ],
            updatedAt: '2026-05-09T00:00:00.000Z',
            username: 'company_admin',
          },
        ],
      })}
    />,
  );

  expect(html).toContain('公司管理员');
  expect(html).toContain('company_admin');
  expect(html).toContain('分配范围');
});
```

Extend `operationsWorkspaceProps` defaults with `currentAdmin`, `companyAdmins`, and new callbacks.

- [ ] **Step 2: Run page tests to verify they fail**

Run:

```bash
pnpm --filter web test -- pages.test.tsx
```

Expected: FAIL because the component does not accept `currentAdmin` or company-admin props.

- [ ] **Step 3: Add role props and derived flag**

In `apps/web/src/pages/OperationsWorkspace.tsx`, import:

```ts
import type {
  AdminCompanyAdmin,
  AdminPrincipal,
  // existing imports
} from '../types/api';
```

Add props:

```ts
  companyAdmins: AdminCompanyAdmin[];
  currentAdmin?: AdminPrincipal;
  companyAdminDisplayName: string;
  companyAdminEnabled: boolean;
  companyAdminPassword: string;
  companyAdminScopeCompanyId: string;
  companyAdminScopeGameIds: string[];
  companyAdminUsername: string;
  selectedCompanyAdminId: string;
  onCompanyAdminDisplayNameChange(value: string): void;
  onCompanyAdminEnabledChange(value: boolean): void;
  onCompanyAdminPasswordChange(value: string): void;
  onCompanyAdminScopeCompanyIdChange(value: string): void;
  onCompanyAdminScopeGameIdsChange(value: string[]): void;
  onCompanyAdminUsernameChange(value: string): void;
  onCreateCompanyAdmin(): void;
  onSaveCompanyAdminScopes(): void;
  onSelectedCompanyAdminIdChange(value: string): void;
  onToggleCompanyAdminEnabled(adminId: string, enabled: boolean): void;
```

Add:

```ts
const isSuperAdmin = currentAdmin?.role === 'SUPER_ADMIN';
const isCompanyAdmin = currentAdmin?.role === 'COMPANY_ADMIN';
```

- [ ] **Step 4: Hide super-admin-only panels for company admins**

Wrap super-admin-only controls with local conditional sections:

- Budget management create/update forms only render for `isSuperAdmin`.
- Kuaishou token panel only renders for `isSuperAdmin`.
- Game configuration save and budget allocation controls only render for `isSuperAdmin`.
- Settlement preview/confirm form only renders for `isSuperAdmin`; settlement batch list remains visible.
- Withdrawal action buttons only render for `isSuperAdmin`; withdrawal list remains visible.
- ECPM manual refresh button only renders for `isSuperAdmin`; ECPM job list remains visible.

Add a compact read-only notice near the top for company admins:

```tsx
{isCompanyAdmin ? (
  <Alert tone="info">
    公司管理员当前仅开放只读权限，结算、提现审核和配置变更由超级管理员处理。
  </Alert>
) : null}
```

- [ ] **Step 5: Add super-admin company-admin management panel**

Add a new panel rendered only for `isSuperAdmin`:

```tsx
{isSuperAdmin ? (
  <Panel description="创建账号并分配公司/游戏只读范围" title="公司管理员">
    <div className="form-grid">
      <InputField
        label="用户名"
        onChange={onCompanyAdminUsernameChange}
        value={companyAdminUsername}
      />
      <InputField
        label="显示名"
        onChange={onCompanyAdminDisplayNameChange}
        value={companyAdminDisplayName}
      />
      <InputField
        label="初始密码"
        onChange={onCompanyAdminPasswordChange}
        type="password"
        value={companyAdminPassword}
      />
      <label className="ui-checkbox-row">
        <input
          checked={companyAdminEnabled}
          onChange={(event) => onCompanyAdminEnabledChange(event.target.checked)}
          type="checkbox"
        />
        启用账号
      </label>
    </div>
    <Button
      disabled={
        !companyAdminUsername.trim() ||
        !companyAdminDisplayName.trim() ||
        companyAdminPassword.length < 8 ||
        busyAction === 'company-admin'
      }
      onClick={onCreateCompanyAdmin}
      variant="primary"
    >
      创建公司管理员
    </Button>
    <div className="table-scroll">
      <table className="data-table">
        <thead>
          <tr>
            <th>用户名</th>
            <th>显示名</th>
            <th>状态</th>
            <th>授权范围</th>
          </tr>
        </thead>
        <tbody>
          {companyAdmins.map((admin) => (
            <tr key={admin.id}>
              <td>{admin.username}</td>
              <td>{admin.displayName}</td>
              <td>{admin.enabled ? '启用' : '禁用'}</td>
              <td>
                {admin.scopes.length
                  ? admin.scopes
                      .map(
                        (scope) =>
                          `${scope.companyId}: ${scope.gameIds.length} 个游戏`,
                      )
                      .join('，')
                  : '未分配'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    <div className="form-grid">
      <label>
        <span className="ui-input-label">选择账号</span>
        <select
          className="ui-input"
          onChange={(event) => onSelectedCompanyAdminIdChange(event.target.value)}
          value={selectedCompanyAdminId}
        >
          {companyAdmins.map((admin) => (
            <option key={admin.id} value={admin.id}>
              {admin.displayName} ({admin.username})
            </option>
          ))}
        </select>
      </label>
      <label>
        <span className="ui-input-label">授权公司</span>
        <select
          className="ui-input"
          onChange={(event) =>
            onCompanyAdminScopeCompanyIdChange(event.target.value)
          }
          value={companyAdminScopeCompanyId}
        >
          {adminCompanies.map((company) => (
            <option key={company.id} value={company.id}>
              {company.name}
            </option>
          ))}
        </select>
      </label>
    </div>
    <div className="check-list">
      {adminGames
        .filter((game) => game.companyId === companyAdminScopeCompanyId)
        .map((game) => (
          <label className="ui-checkbox-row" key={game.id}>
            <input
              checked={companyAdminScopeGameIds.includes(game.id)}
              onChange={(event) => {
                const next = event.target.checked
                  ? [...companyAdminScopeGameIds, game.id]
                  : companyAdminScopeGameIds.filter((id) => id !== game.id);
                onCompanyAdminScopeGameIdsChange(next);
              }}
              type="checkbox"
            />
            {game.name}
          </label>
        ))}
    </div>
    <Button
      disabled={
        !selectedCompanyAdminId ||
        !companyAdminScopeCompanyId ||
        busyAction === 'company-admin'
      }
      onClick={onSaveCompanyAdminScopes}
      variant="secondary"
    >
      保存授权范围
    </Button>
  </Panel>
) : null}
```

Use the existing local `InputField`, `Button`, `Panel`, and plain `<select>`/`<table>` patterns already present in `OperationsWorkspace.tsx`; keep the data and callbacks from this step unchanged.

- [ ] **Step 6: Wire App state/actions for company admin management**

In `App.tsx`, add state:

```ts
const [companyAdmins, setCompanyAdmins] = useState<AdminCompanyAdmin[]>([]);
const [companyAdminUsername, setCompanyAdminUsername] = useState('');
const [companyAdminDisplayName, setCompanyAdminDisplayName] = useState('');
const [companyAdminPassword, setCompanyAdminPassword] = useState('');
const [companyAdminEnabled, setCompanyAdminEnabled] = useState(true);
const [selectedCompanyAdminId, setSelectedCompanyAdminId] = useState('');
const [companyAdminScopeCompanyId, setCompanyAdminScopeCompanyId] = useState('');
const [companyAdminScopeGameIds, setCompanyAdminScopeGameIds] = useState<string[]>([]);
```

Add actions:

```ts
async function loadCompanyAdmins(token = adminAccessToken, isCurrent = () => true) {
  if (!token || !isSuperAdmin(currentAdmin)) return;
  const result = await aiKsApi.getCompanyAdmins(token);
  if (!isCurrent()) return;
  setCompanyAdmins(result.admins);
  setSelectedCompanyAdminId((current) => current || result.admins[0]?.id || '');
}

async function createCompanyAdmin() {
  if (!isSuperAdmin(currentAdmin)) {
    setError('无权限访问该操作');
    return;
  }
  await runAction('company-admin', async (isCurrent) => {
    await aiKsApi.createCompanyAdmin(adminAccessToken, {
      displayName: companyAdminDisplayName.trim(),
      enabled: companyAdminEnabled,
      password: companyAdminPassword,
      username: companyAdminUsername.trim(),
    });
    setNotice('公司管理员已创建');
    setCompanyAdminPassword('');
    await loadCompanyAdmins(adminAccessToken, isCurrent);
  });
}

async function saveCompanyAdminScopes() {
  if (!isSuperAdmin(currentAdmin)) {
    setError('无权限访问该操作');
    return;
  }
  await runAction('company-admin', async (isCurrent) => {
    await aiKsApi.updateCompanyAdminScopes(
      adminAccessToken,
      selectedCompanyAdminId,
      {
        scopes: [
          {
            companyId: companyAdminScopeCompanyId,
            gameIds: companyAdminScopeGameIds,
          },
        ],
      },
    );
    setNotice('公司管理员授权范围已保存');
    await loadCompanyAdmins(adminAccessToken, isCurrent);
  });
}
```

Add `'company-admin'` to `OperationsWorkspaceBusyAction` and `AppBusyAction`.

- [ ] **Step 7: Run page tests**

Run:

```bash
pnpm --filter web test -- pages.test.tsx
```

Expected: PASS.

- [ ] **Step 8: Commit operations UI**

Run:

```bash
git add apps/web/src/pages/OperationsWorkspace.tsx apps/web/src/pages/pages.test.tsx apps/web/src/App.tsx apps/web/src/types/api.ts
git commit -m "feat(web): add company admin read-only workspace"
```

---

## Task 9: Final Verification and Runtime Smoke

**Files:**
- No code changes expected.

- [ ] **Step 1: Push schema to local `.env` database**

Run:

```bash
pnpm --filter api prisma:push
```

Expected: PASS and Prisma Client generated. If the command cannot reach the database because of sandbox/network restrictions, rerun it with the approved escalation flow.

- [ ] **Step 2: Validate Prisma schema**

Run:

```bash
pnpm --filter api prisma:validate
```

Expected: PASS with `The schema at prisma/schema.prisma is valid`.

- [ ] **Step 3: Generate Prisma client**

Run:

```bash
pnpm --filter api prisma:generate
```

Expected: PASS.

- [ ] **Step 4: Run API tests**

Run:

```bash
pnpm --filter api test
```

Expected: PASS.

- [ ] **Step 5: Build API**

Run:

```bash
pnpm --filter api build
```

Expected: PASS.

- [ ] **Step 6: Run web tests**

Run:

```bash
pnpm --filter web test
```

Expected: PASS.

- [ ] **Step 7: Run web lint**

Run:

```bash
pnpm --filter web lint
```

Expected: PASS.

- [ ] **Step 8: Build web**

Run:

```bash
pnpm --filter web build
```

Expected: PASS.

- [ ] **Step 9: Smoke check API startup**

Run:

```bash
pnpm dev:api
```

Expected: API starts successfully with the root `.env` database. Confirm:

```bash
curl --max-time 5 -sS -i http://localhost:8007/api/health
```

Expected: `HTTP/1.1 200 OK`.

- [ ] **Step 10: Confirm working tree**

Run:

```bash
git status --short
```

Expected: no output.
