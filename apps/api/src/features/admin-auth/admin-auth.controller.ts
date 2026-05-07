import { Body, Controller, Post } from '@nestjs/common';
import { z } from 'zod';
import { AdminAuthService } from './admin-auth.service';

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
}
