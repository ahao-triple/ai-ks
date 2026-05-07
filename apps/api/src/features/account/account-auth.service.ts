import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';

export type AccountPrincipal = {
  id: string;
  readableId: string;
  username: string;
};

type AccountTokenPayload = {
  readableId: string;
  sub: string;
  typ: 'account';
  username: string;
};

@Injectable()
export class AccountAuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async issueAccessToken(account: AccountPrincipal): Promise<string> {
    return this.jwtService.signAsync(
      {
        readableId: account.readableId,
        sub: account.id,
        typ: 'account',
        username: account.username,
      } satisfies AccountTokenPayload,
      {
        expiresIn: this.resolveExpiresIn(),
        secret: this.resolveSecret(),
      },
    );
  }

  async verifyAccessToken(accessToken: string): Promise<AccountPrincipal> {
    try {
      const payload = await this.jwtService.verifyAsync<AccountTokenPayload>(
        accessToken,
        {
          secret: this.resolveSecret(),
        },
      );

      if (
        payload.typ !== 'account' ||
        !payload.sub ||
        !payload.username ||
        !payload.readableId
      ) {
        throw new UnauthorizedException('登录已失效，请重新登录');
      }

      return {
        id: payload.sub,
        readableId: payload.readableId,
        username: payload.username,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      throw new UnauthorizedException('登录已失效，请重新登录');
    }
  }

  private resolveSecret() {
    return (
      this.configService.get<string>('JWT_SECRET') ??
      'ai-ks-local-development-secret'
    );
  }

  private resolveExpiresIn(): JwtSignOptions['expiresIn'] {
    return (
      this.configService.get<JwtSignOptions['expiresIn']>('JWT_EXPIRES_IN') ??
      '7d'
    );
  }
}
