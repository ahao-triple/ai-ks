import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import { type AdminPrincipal } from '../admin-auth/admin-auth.service';
import { AdminJwtGuard } from '../admin-auth/admin-jwt.guard';
import { CurrentAdmin } from '../admin-auth/current-admin.decorator';
import { AuditLogService } from '../audit/audit-log.service';
import {
  KuaishouTokenService,
  type KuaishouTokenStatusResult,
} from './kuaishou-token.service';

const authorizeSchema = z.object({
  appId: z.string().trim().min(1),
  authCode: z.string().trim().min(1),
  secret: z.string().trim().min(1),
});

@Controller('admin/kuaishou/token')
@UseGuards(AdminJwtGuard)
export class KuaishouTokenController {
  constructor(
    private readonly tokenService: KuaishouTokenService,
    private readonly auditLogService: AuditLogService,
  ) {}

  @Get()
  async status() {
    return presentTokenStatus(await this.tokenService.getStatus());
  }

  @Post('authorize')
  async authorize(
    @CurrentAdmin() admin: AdminPrincipal,
    @Body() body: unknown,
  ) {
    const parsed = authorizeSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException('appId, secret and authCode are required');
    }

    try {
      const status = await this.tokenService.authorizeWithAuthCode({
        actor: admin,
        appId: parsed.data.appId,
        authCode: parsed.data.authCode,
        secret: parsed.data.secret,
      });
      await this.recordTokenAudit(admin, 'kuaishou.token_authorized', {
        status,
      });

      return presentTokenStatus(status);
    } catch (error) {
      await this.recordTokenAudit(admin, 'kuaishou.token_authorize_failed', {
        appId: parsed.data.appId,
        error: readErrorMessage(error),
      });
      throw error;
    }
  }

  @Post('refresh')
  async refresh(@CurrentAdmin() admin: AdminPrincipal) {
    try {
      const status = await this.tokenService.refreshStoredToken({
        actor: admin,
      });
      await this.recordTokenAudit(admin, 'kuaishou.token_refreshed', {
        status,
      });

      return presentTokenStatus(status);
    } catch (error) {
      await this.recordTokenAudit(admin, 'kuaishou.token_refresh_failed', {
        error: readErrorMessage(error),
      });
      throw error;
    }
  }

  private recordTokenAudit(
    admin: AdminPrincipal,
    action: string,
    input:
      | {
          appId?: string;
          error: string;
        }
      | {
          status: KuaishouTokenStatusResult;
        },
  ) {
    return this.auditLogService.record({
      action,
      actorId: admin.username,
      actorType: admin.role,
      metadata:
        'status' in input
          ? {
              accessTokenExpiresAt: presentDate(
                input.status.accessTokenExpiresAt,
              ),
              advertiserId: input.status.advertiserId ?? null,
              appId: input.status.appId ?? null,
              refreshTokenExpiresAt: presentDate(
                input.status.refreshTokenExpiresAt,
              ),
              status: input.status.status,
            }
          : {
              ...(input.appId ? { appId: input.appId } : {}),
              error: input.error,
            },
      targetId: 'default',
      targetType: 'kuaishou_platform_token',
    });
  }
}

function presentTokenStatus(status: KuaishouTokenStatusResult) {
  return {
    accessTokenExpiresAt: presentDate(status.accessTokenExpiresAt),
    advertiserId: status.advertiserId ?? null,
    appId: status.appId ?? null,
    authorizedAt: presentDate(status.authorizedAt),
    configured: status.configured,
    lastError: status.lastError ?? null,
    refreshTokenExpiresAt: presentDate(status.refreshTokenExpiresAt),
    refreshedAt: presentDate(status.refreshedAt),
    source: status.source,
    status: status.status,
  };
}

function presentDate(value?: Date | null) {
  return value ? value.toISOString() : null;
}

function readErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'unknown error';
}
