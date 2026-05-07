import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { type AccountPrincipal } from './account-auth.service';
import { type AccountRequest } from './account-jwt.guard';

export const CurrentAccount = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AccountPrincipal => {
    const request = context.switchToHttp().getRequest<AccountRequest>();
    if (!request.account) {
      throw new Error('CurrentAccount used without AccountJwtGuard');
    }

    return request.account;
  },
);
