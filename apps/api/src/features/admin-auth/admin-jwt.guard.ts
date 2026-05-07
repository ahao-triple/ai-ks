import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AdminAuthService, type AdminPrincipal } from './admin-auth.service';

export type AdminRequest = {
  admin?: AdminPrincipal;
  headers: Record<string, string | string[] | undefined>;
};

@Injectable()
export class AdminJwtGuard implements CanActivate {
  constructor(private readonly adminAuthService: AdminAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AdminRequest>();
    const accessToken = readBearerToken(request.headers.authorization);
    if (!accessToken) {
      throw new UnauthorizedException('请先登录管理员账号');
    }

    request.admin = await this.adminAuthService.verifyAccessToken(accessToken);
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
