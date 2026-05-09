import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { hash } from 'bcryptjs';
import {
  AgentAuthService,
  type AgentAuthPrisma,
} from './agent-auth.service';

describe('AgentAuthService', () => {
  it('logs in active agents and verifies issued access tokens', async () => {
    const prisma = createFakePrisma({
      passwordHash: await hash('agent-pass-123', 10),
    });
    const service = new AgentAuthService(
      new JwtService(),
      new ConfigService(),
      prisma,
    );

    const result = await service.login({
      password: 'agent-pass-123',
      username: 'agent_1',
    });

    expect(result.agent).toEqual({
      id: 'agent-1',
      invitationCode: 'AGENT1',
      username: 'agent_1',
    });
    await expect(service.verifyAccessToken(result.accessToken)).resolves.toEqual(
      result.agent,
    );
  });

  it('rejects missing, disabled, deleted, or password-mismatched agents', async () => {
    const service = new AgentAuthService(
      new JwtService(),
      new ConfigService(),
      createFakePrisma({
        enabled: false,
        passwordHash: await hash('agent-pass-123', 10),
      }),
    );

    await expect(
      service.login({
        password: 'agent-pass-123',
        username: 'agent_1',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

function createFakePrisma(
  agent: {
    deletedAt?: Date | null;
    enabled?: boolean;
    passwordHash: string;
  },
): AgentAuthPrisma {
  return {
    agent: {
      findUnique: async ({ where }: any) =>
        where.username === 'agent_1'
          ? {
              deletedAt: agent.deletedAt ?? null,
              enabled: agent.enabled ?? true,
              id: 'agent-1',
              invitationCode: 'AGENT1',
              passwordHash: agent.passwordHash,
              username: 'agent_1',
            }
          : null,
    } as any,
  };
}
