import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import { yuanToLi } from '../../domain/money/amount';
import {
  type AdminPrincipal,
  requireSuperAdminPrincipal,
} from '../admin-auth/admin-auth.service';
import { AdminJwtGuard } from '../admin-auth/admin-jwt.guard';
import { CurrentAdmin } from '../admin-auth/current-admin.decorator';
import { SuperAdminGuard } from '../admin-auth/super-admin.guard';
import { presentMoneyLi } from '../../common/presenters/money-presenter';
import {
  PlatformConfigService,
  type PlatformBusinessConfig,
} from './platform-config.service';

const percentSchema = z.number().int().min(0).max(100);

const platformConfigUpdateSchema = z.object({
  defaultAgentId: z.string().trim().optional().nullable(),
  defaultAgentRatioPercent: percentSchema,
  directAgentRatioPercent: percentSchema,
  displayRatioPercent: percentSchema,
  feeRatioPercent: percentSchema,
  minWithdrawalYuan: z.string().trim().min(1),
  parentAgentRatioPercent: percentSchema,
  userSettlementRatioPercent: percentSchema,
});

@Controller('admin/platform-config')
@UseGuards(AdminJwtGuard, SuperAdminGuard)
export class PlatformConfigController {
  constructor(private readonly platformConfigService: PlatformConfigService) {}

  @Get()
  async get() {
    const config = await this.platformConfigService.getConfig();
    return presentPlatformConfig(config);
  }

  @Patch()
  async update(@CurrentAdmin() admin: AdminPrincipal, @Body() body: unknown) {
    const actor = requireSuperAdminPrincipal(admin);
    const input = parsePlatformConfigUpdate(body);
    const config = await this.platformConfigService.updateConfig({
      ...input,
      actorId: actor.username,
      actorType: actor.role,
    });

    return presentPlatformConfig(config);
  }
}

export function presentPlatformConfig(config: PlatformBusinessConfig) {
  return {
    defaultAgentId: config.defaultAgentId,
    defaultAgentRatioPercent: config.defaultAgentRatioPercent,
    directAgentRatioPercent: config.directAgentRatioPercent,
    displayRatioPercent: config.displayRatioPercent,
    feeRatioPercent: config.feeRatioPercent,
    minWithdrawal: presentMoneyLi(config.minWithdrawalLi),
    parentAgentRatioPercent: config.parentAgentRatioPercent,
    userSettlementRatioPercent: config.userSettlementRatioPercent,
  };
}

function parsePlatformConfigUpdate(
  input: unknown,
): Omit<PlatformBusinessConfig, 'minWithdrawalLi'> & {
  minWithdrawalLi: bigint;
} {
  const parsed = platformConfigUpdateSchema.safeParse(input);
  if (!parsed.success) {
    throw new BadRequestException('Platform config input is invalid');
  }

  try {
    return {
      defaultAgentId: parsed.data.defaultAgentId?.trim() || null,
      defaultAgentRatioPercent: parsed.data.defaultAgentRatioPercent,
      directAgentRatioPercent: parsed.data.directAgentRatioPercent,
      displayRatioPercent: parsed.data.displayRatioPercent,
      feeRatioPercent: parsed.data.feeRatioPercent,
      minWithdrawalLi: yuanToLi(parsed.data.minWithdrawalYuan),
      parentAgentRatioPercent: parsed.data.parentAgentRatioPercent,
      userSettlementRatioPercent: parsed.data.userSettlementRatioPercent,
    };
  } catch {
    throw new BadRequestException('Minimum withdrawal amount is invalid');
  }
}
