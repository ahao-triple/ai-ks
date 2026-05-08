import {
  BadGatewayException,
  BadRequestException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  type KuaishouPlatformToken,
  KuaishouTokenStatus,
} from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  KuaishouOAuthClient,
  type KuaishouOAuthTokenResult,
} from '../../integrations/kuaishou/kuaishou-oauth.client';
import { type AdminPrincipal } from '../admin-auth/admin-auth.service';

const DEFAULT_TOKEN_KEY = 'default';

type TokenPrisma = Pick<PrismaService, 'kuaishouPlatformToken'>;
type TokenConfig = Pick<ConfigService, 'get'>;

export type KuaishouTokenSource = 'database' | 'env' | 'none';

export type KuaishouTokenStatusResult = {
  accessTokenExpiresAt?: Date | null;
  advertiserId?: string | null;
  appId?: string | null;
  authorizedAt?: Date | null;
  configured: boolean;
  lastError?: string | null;
  refreshTokenExpiresAt?: Date | null;
  refreshedAt?: Date | null;
  source: KuaishouTokenSource;
  status: KuaishouTokenStatus;
};

export type KuaishouAuthorizeInput = {
  actor: AdminPrincipal;
  appId: string;
  authCode: string;
  secret: string;
};

export type KuaishouRefreshInput = {
  actor: AdminPrincipal;
};

export type KuaishouReportCredentials = {
  accessToken: string;
  advertiserId: string;
  source: Exclude<KuaishouTokenSource, 'none'>;
};

@Injectable()
export class KuaishouTokenService {
  constructor(
    @Inject(PrismaService) private readonly prisma: TokenPrisma,
    private readonly oauthClient: KuaishouOAuthClient,
    private readonly configService: TokenConfig,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async getStatus(): Promise<KuaishouTokenStatusResult> {
    const token = await this.findToken();
    if (token) {
      return presentTokenStatus(token, this.now());
    }

    const envCredentials = this.readEnvCredentials();
    if (envCredentials) {
      return {
        advertiserId: envCredentials.advertiserId,
        configured: true,
        source: 'env',
        status: KuaishouTokenStatus.ACTIVE,
      };
    }

    return {
      configured: false,
      source: 'none',
      status: KuaishouTokenStatus.UNCONFIGURED,
    };
  }

  async authorizeWithAuthCode(
    input: KuaishouAuthorizeInput,
  ): Promise<KuaishouTokenStatusResult> {
    try {
      const result = await this.oauthClient.exchangeAuthCode({
        appId: input.appId,
        authCode: input.authCode,
        secret: input.secret,
      });
      const token = await this.upsertActiveToken({
        appId: input.appId,
        authorizedAt: this.now(),
        result,
        secret: input.secret,
      });

      return presentTokenStatus(token, this.now());
    } catch (error) {
      const message = readErrorMessage(error);
      await this.upsertErrorToken({
        appId: input.appId,
        lastError: message,
        secret: input.secret,
      });
      throw new BadGatewayException(`快手授权失败：${message}`);
    }
  }

  async refreshStoredToken(
    _input: KuaishouRefreshInput,
  ): Promise<KuaishouTokenStatusResult> {
    const token = await this.findToken();
    if (!token?.refreshToken) {
      throw new BadRequestException('缺少 refresh token，请重新授权');
    }

    try {
      const result = await this.oauthClient.refreshAccessToken({
        appId: token.appId,
        refreshToken: token.refreshToken,
        secret: token.secret,
      });
      const updated = await this.upsertActiveToken({
        appId: token.appId,
        authorizedAt: token.authorizedAt ?? this.now(),
        refreshedAt: this.now(),
        result,
        secret: token.secret,
      });

      return presentTokenStatus(updated, this.now());
    } catch (error) {
      const message = readErrorMessage(error);
      await this.markTokenError(message);
      throw new BadGatewayException(`快手 token 刷新失败：${message}`);
    }
  }

  async resolveReportCredentials(): Promise<KuaishouReportCredentials> {
    const token = await this.findToken();
    if (token && isUsableDatabaseToken(token, this.now())) {
      return {
        accessToken: token.accessToken!,
        advertiserId: token.advertiserId!,
        source: 'database',
      };
    }

    const envCredentials = this.readEnvCredentials();
    if (envCredentials) {
      return {
        ...envCredentials,
        source: 'env',
      };
    }

    throw new Error('Kuaishou access token is not configured');
  }

  async markTokenError(message: string) {
    const token = await this.findToken();
    if (!token) {
      return;
    }

    await this.prisma.kuaishouPlatformToken.update({
      data: {
        lastError: message,
        status: KuaishouTokenStatus.ERROR,
      },
      where: {
        key: DEFAULT_TOKEN_KEY,
      },
    });
  }

  private findToken() {
    return this.prisma.kuaishouPlatformToken.findUnique({
      where: {
        key: DEFAULT_TOKEN_KEY,
      },
    });
  }

  private readEnvCredentials() {
    const accessToken = this.configService.get<string>('KUAISHOU_ACCESS_TOKEN');
    const advertiserId = this.configService.get<string>(
      'KUAISHOU_ADVERTISER_ID',
    );

    return accessToken && advertiserId
      ? {
          accessToken,
          advertiserId,
        }
      : undefined;
  }

  private upsertActiveToken(input: {
    appId: string;
    authorizedAt: Date;
    refreshedAt?: Date;
    result: KuaishouOAuthTokenResult;
    secret: string;
  }) {
    const accessTokenExpiresAt = addSeconds(
      this.now(),
      input.result.accessTokenExpiresIn,
    );
    const refreshTokenExpiresAt = addSeconds(
      this.now(),
      input.result.refreshTokenExpiresIn,
    );

    return this.prisma.kuaishouPlatformToken.upsert({
      create: {
        accessToken: input.result.accessToken,
        accessTokenExpiresAt,
        advertiserId: input.result.advertiserId,
        appId: input.appId,
        authorizedAt: input.authorizedAt,
        key: DEFAULT_TOKEN_KEY,
        lastError: null,
        refreshedAt: input.refreshedAt,
        refreshToken: input.result.refreshToken,
        refreshTokenExpiresAt,
        secret: input.secret,
        status: KuaishouTokenStatus.ACTIVE,
      },
      update: {
        accessToken: input.result.accessToken,
        accessTokenExpiresAt,
        advertiserId: input.result.advertiserId,
        appId: input.appId,
        authorizedAt: input.authorizedAt,
        lastError: null,
        refreshedAt: input.refreshedAt,
        refreshToken: input.result.refreshToken,
        refreshTokenExpiresAt,
        secret: input.secret,
        status: KuaishouTokenStatus.ACTIVE,
      },
      where: {
        key: DEFAULT_TOKEN_KEY,
      },
    });
  }

  private upsertErrorToken(input: {
    appId: string;
    lastError: string;
    secret: string;
  }) {
    return this.prisma.kuaishouPlatformToken.upsert({
      create: {
        appId: input.appId,
        key: DEFAULT_TOKEN_KEY,
        lastError: input.lastError,
        secret: input.secret,
        status: KuaishouTokenStatus.ERROR,
      },
      update: {
        appId: input.appId,
        lastError: input.lastError,
        secret: input.secret,
        status: KuaishouTokenStatus.ERROR,
      },
      where: {
        key: DEFAULT_TOKEN_KEY,
      },
    });
  }
}

function presentTokenStatus(
  token: KuaishouPlatformToken,
  now: Date,
): KuaishouTokenStatusResult {
  return {
    accessTokenExpiresAt: token.accessTokenExpiresAt,
    advertiserId: token.advertiserId,
    appId: token.appId,
    authorizedAt: token.authorizedAt,
    configured: Boolean(token.accessToken && token.advertiserId),
    lastError: token.lastError,
    refreshTokenExpiresAt: token.refreshTokenExpiresAt,
    refreshedAt: token.refreshedAt,
    source: 'database',
    status: resolveStatus(token, now),
  };
}

function resolveStatus(token: KuaishouPlatformToken, now: Date) {
  if (token.status === KuaishouTokenStatus.ERROR) {
    return token.status;
  }

  if (
    token.accessTokenExpiresAt &&
    token.accessTokenExpiresAt.getTime() <= now.getTime()
  ) {
    return KuaishouTokenStatus.EXPIRED;
  }

  return token.status;
}

function isUsableDatabaseToken(token: KuaishouPlatformToken, now: Date) {
  return (
    token.status === KuaishouTokenStatus.ACTIVE &&
    Boolean(token.accessToken) &&
    Boolean(token.advertiserId) &&
    Boolean(token.accessTokenExpiresAt) &&
    token.accessTokenExpiresAt!.getTime() > now.getTime()
  );
}

function addSeconds(date: Date, seconds: number) {
  return new Date(date.getTime() + seconds * 1000);
}

function readErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'unknown error';
}
