import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { type AdminPrincipal } from './admin-auth.service';
import { type AdminRequest } from './admin-jwt.guard';

export const CurrentAdmin = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AdminPrincipal => {
    const request = context.switchToHttp().getRequest<AdminRequest>();
    if (!request.admin) {
      throw new Error('CurrentAdmin used without AdminJwtGuard');
    }

    return request.admin;
  },
);
