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
import { READ_OPERATION_CODES } from '../admin-auth/admin-access-control.service';

type CompanyAdminPrisma = Pick<
  PrismaService,
  | '$transaction'
  | 'auditLog'
  | 'company'
  | 'companyAdminAccount'
  | 'companyAdminScope'
  | 'game'
>;

type CompanyAdminTx = Omit<CompanyAdminPrisma, '$transaction'>;

export const READ_ONLY_OPERATION_CODES = READ_OPERATION_CODES;

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
        include: {
          scopes: true,
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
        targetType: 'company_admin',
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
    const current = await findActiveCompanyAdmin(this.prisma, input.adminId);
    const changedFields = collectChangedFields(input);
    if (changedFields.length === 0) {
      throw new BadRequestException('Company admin update is invalid');
    }

    const data: Prisma.CompanyAdminAccountUpdateInput = {};
    if (input.displayName !== undefined) {
      data.displayName = input.displayName;
    }
    if (input.enabled !== undefined) {
      data.enabled = input.enabled;
    }
    if (input.password !== undefined) {
      data.passwordHash = await hash(input.password, 10);
    }

    const admin = await this.prisma.companyAdminAccount.update({
      data,
      include: {
        scopes: true,
      },
      where: {
        id: input.adminId,
      },
    });

    await this.recordAudit(input.actor, {
      action: 'company_admin.updated',
      metadata: {
        changedFields,
        username: current.username,
      },
      targetId: admin.id,
      targetType: 'company_admin',
    });

    return admin;
  }

  async replaceScopes(input: ReplaceCompanyAdminScopesInput) {
    return this.prisma.$transaction(async (tx) => {
      const prisma = tx as CompanyAdminTx;
      const admin = await findActiveCompanyAdmin(prisma, input.adminId);
      const scopes = await normalizeScopes(prisma, input.scopes);

      await prisma.companyAdminScope.deleteMany({
        where: {
          companyAdminId: input.adminId,
        },
      });
      if (scopes.length > 0) {
        await prisma.companyAdminScope.createMany({
          data: scopes.map((scope) => ({
            companyAdminId: input.adminId,
            companyId: scope.companyId,
            gameIds: scope.gameIds,
            operationCodes: [...READ_ONLY_OPERATION_CODES],
          })),
        });
      }

      await this.recordAudit(
        input.actor,
        {
          action: 'company_admin.scopes_updated',
          metadata: {
            scopes: scopes.map((scope) => ({
              companyId: scope.companyId,
              gameIds: scope.gameIds,
              operationCodes: [...READ_ONLY_OPERATION_CODES],
            })),
            username: admin.username,
          },
          targetId: admin.id,
          targetType: 'company_admin',
        },
        prisma,
      );

      const updated = await prisma.companyAdminAccount.findUnique({
        include: {
          scopes: true,
        },
        where: {
          id: input.adminId,
        },
      });
      if (!updated) {
        throw new NotFoundException('Company admin not found');
      }

      return updated;
    });
  }

  private recordAudit(
    actor: AdminPrincipal,
    input: {
      action: string;
      metadata: Prisma.InputJsonObject;
      targetId: string;
      targetType: string;
    },
    prisma: CompanyAdminTx = this.prisma,
  ) {
    return prisma.auditLog.create({
      data: {
        action: input.action,
        actorId: getAdminActorId(actor),
        actorType: actor.role,
        metadata: input.metadata,
        targetId: input.targetId,
        targetType: input.targetType,
      },
    });
  }
}

async function findActiveCompanyAdmin(
  prisma: Pick<CompanyAdminPrisma, 'companyAdminAccount'>,
  adminId: string,
) {
  const admin = await prisma.companyAdminAccount.findUnique({
    where: {
      id: adminId,
    },
  });
  if (!admin || admin.deletedAt) {
    throw new NotFoundException('Company admin not found');
  }

  return admin;
}

async function normalizeScopes(
  prisma: Pick<CompanyAdminPrisma, 'company' | 'game'>,
  scopes: ReplaceCompanyAdminScopesInput['scopes'],
) {
  const scopesByCompanyId = new Map<string, Set<string>>();

  for (const scope of scopes) {
    if (scope.gameIds.length === 0) {
      throw new BadRequestException('Company admin scope games are invalid');
    }

    const gameIds = scopesByCompanyId.get(scope.companyId) ?? new Set<string>();
    for (const gameId of scope.gameIds) {
      gameIds.add(gameId);
    }
    scopesByCompanyId.set(scope.companyId, gameIds);
  }

  const normalized = [...scopesByCompanyId.entries()]
    .map(([companyId, gameIds]) => ({
      companyId,
      gameIds: uniqueSorted([...gameIds]),
    }))
    .sort((left, right) => left.companyId.localeCompare(right.companyId));

  for (const scope of normalized) {
    const company = await prisma.company.findUnique({
      where: {
        id: scope.companyId,
      },
    });
    if (!company || company.deletedAt) {
      throw new NotFoundException('Company not found');
    }

    const games = await prisma.game.findMany({
      select: {
        id: true,
      },
      where: {
        companyId: scope.companyId,
        deletedAt: null,
        id: {
          in: scope.gameIds,
        },
      },
    });
    if (games.length !== scope.gameIds.length) {
      throw new BadRequestException('Company admin scope games are invalid');
    }
  }

  return normalized;
}

function collectChangedFields(input: UpdateCompanyAdminInput) {
  const fields: string[] = [];
  if (input.displayName !== undefined) {
    fields.push('displayName');
  }
  if (input.enabled !== undefined) {
    fields.push('enabled');
  }
  if (input.password !== undefined) {
    fields.push('password');
  }

  return fields;
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError ||
    (typeof error === 'object' && error !== null && 'code' in error)
  ) && (error as { code?: string }).code === 'P2002';
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}
