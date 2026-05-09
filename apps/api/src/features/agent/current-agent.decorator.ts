import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { type AgentPrincipal } from './agent-auth.service';
import { type AgentRequest } from './agent-jwt.guard';

export const CurrentAgent = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AgentPrincipal => {
    const request = context.switchToHttp().getRequest<AgentRequest>();
    if (!request.agent) {
      throw new Error('CurrentAgent used without AgentJwtGuard');
    }

    return request.agent;
  },
);
