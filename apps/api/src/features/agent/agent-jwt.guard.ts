import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import {
  AgentAuthService,
  type AgentPrincipal,
} from './agent-auth.service';

export type AgentRequest = {
  agent?: AgentPrincipal;
  headers: Record<string, string | string[] | undefined>;
};

@Injectable()
export class AgentJwtGuard implements CanActivate {
  constructor(private readonly agentAuthService: AgentAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AgentRequest>();
    const accessToken = readBearerToken(request.headers.authorization);
    if (!accessToken) {
      throw new UnauthorizedException('请先登录代理账号');
    }

    request.agent = await this.agentAuthService.verifyAccessToken(accessToken);
    return true;
  }
}

function readBearerToken(value: string | string[] | undefined) {
  const authorization = Array.isArray(value) ? value[0] : value;
  if (!authorization) {
    return undefined;
  }

  const [scheme, token] = authorization.split(' ');
  return scheme === 'Bearer' && token ? token : undefined;
}
