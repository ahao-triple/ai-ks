import {
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import { compare } from 'bcryptjs';
import { PrismaService } from '../../common/prisma/prisma.service';

export type AgentPrincipal = {
  id: string;
  invitationCode: string;
  username: string;
};

export type AgentLoginInput = {
  password: string;
  username: string;
};

type AgentTokenPayload = {
  invitationCode: string;
  sub: string;
  typ: 'agent';
  username: string;
};

export type AgentAuthPrisma = Pick<PrismaService, 'agent'>;

@Injectable()
export class AgentAuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @Inject(PrismaService) private readonly prisma: AgentAuthPrisma,
  ) {}

  async login(input: AgentLoginInput) {
    const agent = await this.prisma.agent.findUnique({
      where: {
        username: input.username,
      },
    });

    if (
      !agent ||
      agent.deletedAt !== null ||
      !agent.enabled ||
      !(await compare(input.password, agent.passwordHash))
    ) {
      throw new UnauthorizedException('代理账号或密码错误');
    }

    const principal = {
      id: agent.id,
      invitationCode: agent.invitationCode,
      username: agent.username,
    };

    return {
      accessToken: await this.issueAccessToken(principal),
      agent: principal,
    };
  }

  async issueAccessToken(agent: AgentPrincipal): Promise<string> {
    return this.jwtService.signAsync(
      {
        invitationCode: agent.invitationCode,
        sub: agent.id,
        typ: 'agent',
        username: agent.username,
      } satisfies AgentTokenPayload,
      {
        expiresIn: this.resolveExpiresIn(),
        secret: this.resolveSecret(),
      },
    );
  }

  async verifyAccessToken(accessToken: string): Promise<AgentPrincipal> {
    try {
      const payload = await this.jwtService.verifyAsync<AgentTokenPayload>(
        accessToken,
        {
          secret: this.resolveSecret(),
        },
      );

      if (
        payload.typ !== 'agent' ||
        !payload.sub ||
        !payload.username ||
        !payload.invitationCode
      ) {
        throw new UnauthorizedException('代理登录已失效，请重新登录');
      }

      return {
        id: payload.sub,
        invitationCode: payload.invitationCode,
        username: payload.username,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      throw new UnauthorizedException('代理登录已失效，请重新登录');
    }
  }

  private resolveSecret() {
    return (
      this.configService.get<string>('AGENT_JWT_SECRET') ??
      this.configService.get<string>('JWT_SECRET') ??
      'ai-ks-local-agent-secret'
    );
  }

  private resolveExpiresIn(): JwtSignOptions['expiresIn'] {
    return (
      this.configService.get<JwtSignOptions['expiresIn']>(
        'AGENT_JWT_EXPIRES_IN',
      ) ?? '7d'
    );
  }
}
