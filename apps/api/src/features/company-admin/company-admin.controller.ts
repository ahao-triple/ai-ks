import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import { type AdminPrincipal } from '../admin-auth/admin-auth.service';
import { AdminJwtGuard } from '../admin-auth/admin-jwt.guard';
import { CurrentAdmin } from '../admin-auth/current-admin.decorator';
import { SuperAdminGuard } from '../admin-auth/super-admin.guard';
import { CompanyAdminService } from './company-admin.service';

const idSchema = z.string().trim().min(1);

const createCompanyAdminSchema = z.object({
  displayName: idSchema,
  enabled: z.boolean().optional(),
  password: z.string().min(8),
  username: idSchema,
});

const updateCompanyAdminSchema = z.object({
  displayName: idSchema.optional(),
  enabled: z.boolean().optional(),
  password: z.string().min(8).optional(),
});

const replaceScopesSchema = z.object({
  scopes: z.array(
    z.object({
      companyId: idSchema,
      gameIds: z.array(idSchema).min(1),
    }),
  ),
});

@Controller('admin/company-admins')
@UseGuards(AdminJwtGuard, SuperAdminGuard)
export class CompanyAdminController {
  constructor(private readonly companyAdminService: CompanyAdminService) {}

  @Get()
  async list() {
    const admins = await this.companyAdminService.listCompanyAdmins();

    return {
      admins: admins.map(presentCompanyAdmin),
    };
  }

  @Post()
  async create(@CurrentAdmin() admin: AdminPrincipal, @Body() body: unknown) {
    const input = parseBody(
      createCompanyAdminSchema,
      body,
      'Company admin input is invalid',
    );
    const companyAdmin = await this.companyAdminService.createCompanyAdmin({
      actor: admin,
      displayName: input.displayName,
      enabled: input.enabled,
      password: input.password,
      username: input.username,
    });

    return {
      admin: presentCompanyAdmin(companyAdmin),
    };
  }

  @Patch(':adminId')
  async update(
    @CurrentAdmin() admin: AdminPrincipal,
    @Param('adminId') adminId: string,
    @Body() body: unknown,
  ) {
    const input = parseBody(
      updateCompanyAdminSchema,
      body,
      'Company admin update is invalid',
    );
    if (
      input.displayName === undefined &&
      input.enabled === undefined &&
      input.password === undefined
    ) {
      throw new BadRequestException('Company admin update is invalid');
    }

    const companyAdmin = await this.companyAdminService.updateCompanyAdmin({
      actor: admin,
      adminId: parseId(adminId, 'Company admin id is invalid'),
      displayName: input.displayName,
      enabled: input.enabled,
      password: input.password,
    });

    return {
      admin: presentCompanyAdmin(companyAdmin),
    };
  }

  @Put(':adminId/scopes')
  async replaceScopes(
    @CurrentAdmin() admin: AdminPrincipal,
    @Param('adminId') adminId: string,
    @Body() body: unknown,
  ) {
    const input = parseBody(
      replaceScopesSchema,
      body,
      'Company admin scope input is invalid',
    );
    const companyAdmin = await this.companyAdminService.replaceScopes({
      actor: admin,
      adminId: parseId(adminId, 'Company admin id is invalid'),
      scopes: input.scopes,
    });

    return {
      admin: presentCompanyAdmin(companyAdmin),
    };
  }
}

function parseBody<T extends z.ZodTypeAny>(
  schema: T,
  body: unknown,
  message: string,
): z.infer<T> {
  const parsed = schema.safeParse(body ?? {});
  if (!parsed.success) {
    throw new BadRequestException(message);
  }

  return parsed.data;
}

function parseId(value: string, message: string) {
  const parsed = idSchema.safeParse(value);
  if (!parsed.success) {
    throw new BadRequestException(message);
  }

  return parsed.data;
}

function presentCompanyAdmin(admin: {
  createdAt: Date;
  deletedAt: Date | null;
  displayName: string;
  enabled: boolean;
  id: string;
  scopes?: Array<{
    companyId: string;
    gameIds: string[];
    operationCodes: string[];
  }>;
  updatedAt: Date;
  username: string;
}) {
  return {
    createdAt: admin.createdAt.toISOString(),
    deletedAt: admin.deletedAt ? admin.deletedAt.toISOString() : null,
    displayName: admin.displayName,
    enabled: admin.enabled,
    id: admin.id,
    scopes: (admin.scopes ?? []).map((scope) => ({
      companyId: scope.companyId,
      gameIds: scope.gameIds,
      operationCodes: scope.operationCodes,
    })),
    updatedAt: admin.updatedAt.toISOString(),
    username: admin.username,
  };
}
