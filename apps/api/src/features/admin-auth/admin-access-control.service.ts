import { ForbiddenException, Inject, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  getAdminActorId,
  type AdminPrincipal,
} from './admin-auth.service';

type AdminAccessControlPrisma = Pick<
  PrismaService,
  'auditLog' | 'companyAdminScope' | 'game'
>;

export const READ_OPERATION_CODES = [
  'company.read',
  'game.read',
  'settlement.read',
  'withdrawal.read',
  'ecpm.read',
  'audit.read',
] as const;

export type AdminRouteContext = {
  method: string;
  path: string;
};

export type AdminReadScope = {
  companyIds: string[] | undefined;
  gameAppIds: string[] | undefined;
  gameIds: string[] | undefined;
  isSuperAdmin: boolean;
};

@Injectable()
export class AdminAccessControlService {
  private readonly logger = new Logger(AdminAccessControlService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: AdminAccessControlPrisma,
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
    const scopedGameIds = uniqueSorted(
      scopes.flatMap((scope) => scope.gameIds),
    );
    if (scopedGameIds.length === 0) {
      return {
        companyIds: [],
        gameAppIds: [],
        gameIds: [],
        isSuperAdmin: false,
      };
    }

    const activeGames = await this.prisma.game.findMany({
      select: {
        gameAppId: true,
        id: true,
      },
      where: {
        deletedAt: null,
        id: {
          in: scopedGameIds,
        },
      },
    });
    const activeGameIds = new Set(activeGames.map((game) => game.id));
    const companyIds = uniqueSorted(
      scopes
        .filter((scope) =>
          scope.gameIds.some((gameId) => activeGameIds.has(gameId)),
        )
        .map((scope) => scope.companyId),
    );

    return {
      companyIds,
      gameAppIds: uniqueSorted(activeGames.map((game) => game.gameAppId)),
      gameIds: uniqueSorted(activeGames.map((game) => game.id)),
      isSuperAdmin: false,
    };
  }

  async assertSuperAdmin(
    admin: AdminPrincipal,
    context: AdminRouteContext,
  ): Promise<void> {
    if (admin.role === 'SUPER_ADMIN') {
      return;
    }

    try {
      await this.recordDenied(admin, context);
    } catch (error) {
      this.logger.warn(
        `Failed to record denied admin access audit: ${String(error)}`,
      );
    }
    throw new ForbiddenException('无权限访问该操作');
  }

  async recordDenied(
    admin: AdminPrincipal,
    context: AdminRouteContext,
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

    return READ_OPERATION_CODES.includes(
      operationCode as (typeof READ_OPERATION_CODES)[number],
    );
  }
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}
