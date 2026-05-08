import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AdminAccessControlService } from './admin-access-control.service';
import { type AdminPrincipal } from './admin-auth.service';

type SuperAdminRequest = {
  admin?: AdminPrincipal;
  method?: string;
  originalUrl?: string;
  url?: string;
};

@Injectable()
export class SuperAdminGuard implements CanActivate {
  constructor(
    private readonly accessControlService: AdminAccessControlService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<SuperAdminRequest>();
    if (!request.admin) {
      throw new UnauthorizedException('请先登录管理员账号');
    }

    await this.accessControlService.assertSuperAdmin(request.admin, {
      method: request.method ?? 'UNKNOWN',
      path: request.originalUrl ?? request.url ?? 'unknown',
    });
    return true;
  }
}
