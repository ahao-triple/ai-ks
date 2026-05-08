import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
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

export function requireSuperAdminPrincipal(
  admin: AdminPrincipal,
): SuperAdminPrincipal {
  if (admin.role !== 'SUPER_ADMIN') {
    throw new ForbiddenException('无权限访问该操作');
  }

  return admin;
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

@Injectable()
export class AdminAuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: AdminAuthPrisma,
  ) {}

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

  async verifyAccessToken(accessToken: string): Promise<AdminPrincipal> {
    try {
      const payload = await this.jwtService.verifyAsync<AdminTokenPayload>(
        accessToken,
        {
          secret: this.resolveSecret(),
        },
      );

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
