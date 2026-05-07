import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';

export type AdminPrincipal = {
  role: 'SUPER_ADMIN';
  username: string;
};

export type AdminLoginInput = {
  password: string;
  username: string;
};

type AdminTokenPayload = {
  role: 'SUPER_ADMIN';
  sub: string;
  typ: 'admin';
};

@Injectable()
export class AdminAuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async login(input: AdminLoginInput) {
    const username = this.resolveUsername();
    const password = this.resolvePassword();
    if (input.username !== username || input.password !== password) {
      throw new UnauthorizedException('管理员账号或密码错误');
    }

    const admin: AdminPrincipal = {
      role: 'SUPER_ADMIN',
      username,
    };

    return {
      accessToken: await this.issueAccessToken(admin),
      admin,
    };
  }

  async issueAccessToken(admin: AdminPrincipal): Promise<string> {
    return this.jwtService.signAsync(
      {
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

  async verifyAccessToken(accessToken: string): Promise<AdminPrincipal> {
    try {
      const payload = await this.jwtService.verifyAsync<AdminTokenPayload>(
        accessToken,
        {
          secret: this.resolveSecret(),
        },
      );

      if (
        payload.typ !== 'admin' ||
        payload.role !== 'SUPER_ADMIN' ||
        !payload.sub
      ) {
        throw new UnauthorizedException('管理员登录已失效，请重新登录');
      }

      return {
        role: payload.role,
        username: payload.sub,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      throw new UnauthorizedException('管理员登录已失效，请重新登录');
    }
  }

  private resolveUsername() {
    return this.configService.get<string>('ADMIN_USERNAME') ?? 'admin';
  }

  private resolvePassword() {
    return this.configService.get<string>('ADMIN_PASSWORD') ?? 'admin123456';
  }

  private resolveSecret() {
    return (
      this.configService.get<string>('ADMIN_JWT_SECRET') ??
      'ai-ks-local-admin-secret'
    );
  }

  private resolveExpiresIn(): JwtSignOptions['expiresIn'] {
    return (
      this.configService.get<JwtSignOptions['expiresIn']>(
        'ADMIN_JWT_EXPIRES_IN',
      ) ?? '7d'
    );
  }
}
