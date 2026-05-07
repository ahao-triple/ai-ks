import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import {
  AccountAuthService,
  type AccountPrincipal,
} from './account-auth.service';

export type AccountRequest = {
  account?: AccountPrincipal;
  headers: Record<string, string | string[] | undefined>;
};

@Injectable()
export class AccountJwtGuard implements CanActivate {
  constructor(private readonly accountAuthService: AccountAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AccountRequest>();
    const accessToken = readBearerToken(request.headers.authorization);
    if (!accessToken) {
      throw new UnauthorizedException('请先登录');
    }

    request.account =
      await this.accountAuthService.verifyAccessToken(accessToken);
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
