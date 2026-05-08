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
  constructor(private readonly tokenService: KuaishouTokenService) {}

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

    return presentTokenStatus(
      await this.tokenService.authorizeWithAuthCode({
        actor: admin,
        appId: parsed.data.appId,
        authCode: parsed.data.authCode,
        secret: parsed.data.secret,
      }),
    );
  }

  @Post('refresh')
  async refresh(@CurrentAdmin() admin: AdminPrincipal) {
    return presentTokenStatus(
      await this.tokenService.refreshStoredToken({
        actor: admin,
      }),
    );
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
