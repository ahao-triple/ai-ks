import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { AdminAuthService, type AdminPrincipal } from './admin-auth.service';
import { AdminJwtGuard } from './admin-jwt.guard';
import { CurrentAdmin } from './current-admin.decorator';

const adminLoginSchema = z.object({
  password: z.string().min(1),
  username: z.string().min(1),
});

@Controller('admin/auth')
export class AdminAuthController {
  constructor(private readonly adminAuthService: AdminAuthService) {}

  @Post('login')
  login(@Body() body: unknown) {
    const input = adminLoginSchema.parse(body);
    return this.adminAuthService.login(input);
  }

  @Get('me')
  @UseGuards(AdminJwtGuard)
  me(@CurrentAdmin() admin: AdminPrincipal) {
    return {
      admin,
    };
  }
}
