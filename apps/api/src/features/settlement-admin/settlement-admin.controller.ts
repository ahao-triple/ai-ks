import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import {
  type AdminPrincipal,
  requireSuperAdminPrincipal,
} from '../admin-auth/admin-auth.service';
import { AdminJwtGuard } from '../admin-auth/admin-jwt.guard';
import { CurrentAdmin } from '../admin-auth/current-admin.decorator';
import { presentMoneyLi } from '../demo/money-presenter';
import {
  SettlementAdminService,
  type SettlementBatchWithItems,
  type SettlementRangeInput,
} from './settlement-admin.service';

const dateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const idSchema = z.string().trim().min(1);

const settlementRangeSchema = z.object({
  endDate: dateOnlySchema,
  gameId: idSchema,
  startDate: dateOnlySchema,
  userId: idSchema.optional(),
});

const settlementListQuerySchema = z.object({
  gameId: idSchema.optional(),
});

@Controller('admin/settlements')
@UseGuards(AdminJwtGuard)
export class SettlementAdminController {
  constructor(private readonly settlementAdminService: SettlementAdminService) {}

  @Get('preview')
  async preview(@Query() query: unknown) {
    const input = parseSettlementRange(query);
    const result = await this.settlementAdminService.previewSettlement(input);

    return {
      budgetAfter: presentMoneyLi(result.budgetAfterLi),
      budgetBefore: presentMoneyLi(result.budgetBeforeLi),
      canConfirm: result.canConfirm,
      companyId: result.companyId,
      gameId: result.gameId,
      settlementAmount: presentMoneyLi(result.settlementAmountLi),
      settlementCount: result.settlementCount,
      unboundCount: result.unboundCount,
      userCount: result.userCount,
    };
  }

  @Post('confirm')
  async confirm(@CurrentAdmin() admin: AdminPrincipal, @Body() body: unknown) {
    const input = parseSettlementRange(body);
    const actor = requireSuperAdminPrincipal(admin);
    const result = await this.settlementAdminService.confirmSettlement({
      ...input,
      operatorId: actor.username,
      operatorType: actor.role,
    });

    return {
      batch: presentSettlementBatch(result.batch),
      items: result.items.map(presentSettlementItem),
    };
  }

  @Get()
  async list(@Query() query: unknown) {
    const input = parseSettlementListQuery(query);
    const batches = await this.settlementAdminService.listBatches({
      gameId: input.gameId,
    });

    return {
      batches: batches.map(presentSettlementBatch),
    };
  }

  @Get(':batchId')
  async detail(@Param('batchId') batchId: string) {
    const batch = await this.settlementAdminService.getBatch(batchId);

    return {
      batch: presentSettlementBatch(batch),
      items: batch.items.map(presentSettlementItem),
    };
  }
}

export function parseSettlementRange(input: unknown): SettlementRangeInput {
  const parsed = settlementRangeSchema.safeParse(input);
  if (!parsed.success) {
    throw new BadRequestException('Settlement range is invalid');
  }

  const startedAt = parseDateBound(parsed.data.startDate, false);
  const endedAt = parseDateBound(parsed.data.endDate, true);
  if (startedAt > endedAt) {
    throw new BadRequestException('Settlement start time cannot be after end');
  }

  return {
    endedAt,
    gameId: parsed.data.gameId,
    startedAt,
    userId: parsed.data.userId,
  };
}

function parseSettlementListQuery(input: unknown) {
  const parsed = settlementListQuerySchema.safeParse(input ?? {});
  if (!parsed.success) {
    throw new BadRequestException('Settlement list query is invalid');
  }

  return parsed.data;
}

function parseDateBound(value: string, endOfDay: boolean) {
  const [yearText, monthText, dayText] = value.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(
    Date.UTC(
      year,
      month - 1,
      day,
      endOfDay ? 23 : 0,
      endOfDay ? 59 : 0,
      endOfDay ? 59 : 0,
      endOfDay ? 999 : 0,
    ),
  );

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new BadRequestException('Settlement date is invalid');
  }

  return date;
}

function presentSettlementBatch(batch: SettlementBatchWithItems) {
  return {
    budgetAfter: presentMoneyLi(batch.budgetAfterLi),
    budgetBefore: presentMoneyLi(batch.budgetBeforeLi),
    companyId: batch.companyId,
    configSnapshot: batch.configSnapshot,
    createdAt: batch.createdAt.toISOString(),
    endedAt: batch.endedAt.toISOString(),
    gameId: batch.gameId,
    id: batch.id,
    operatorId: batch.operatorId,
    operatorType: batch.operatorType,
    settledAmount: presentMoneyLi(batch.settledAmountLi),
    settledCount: batch.settledCount,
    startedAt: batch.startedAt.toISOString(),
    status: batch.status,
    userCount: batch.userCount,
  };
}

function presentSettlementItem(item: SettlementBatchWithItems['items'][number]) {
  return {
    createdAt: item.createdAt.toISOString(),
    displayAmount: presentMoneyLi(item.displayAmountLi),
    gameOpenIdId: item.gameOpenIdId,
    id: item.id,
    openId: item.openId,
    rawEcpmId: item.rawEcpmId,
    settlementAmount: presentMoneyLi(item.settlementAmountLi),
    userId: item.userId,
  };
}
