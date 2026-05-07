import { Inject, Injectable } from '@nestjs/common';
import { SettlementStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

type SettlementPrisma = Pick<
  PrismaService,
  '$transaction' | 'gameOpenId' | 'rawEcpm' | 'userAccount'
>;

export type ConfirmPendingEarningsInput = {
  userId: string;
};

export type ConfirmPendingEarningsResult = {
  settledAmountLi: bigint;
  settledCount: number;
  userId: string;
};

@Injectable()
export class AccountSettlementService {
  constructor(@Inject(PrismaService) private readonly prisma: SettlementPrisma) {}

  async confirmPendingEarnings(
    input: ConfirmPendingEarningsInput,
  ): Promise<ConfirmPendingEarningsResult> {
    return this.prisma.$transaction(async (tx) => {
      const openIdRecords = await tx.gameOpenId.findMany({
        where: {
          userId: input.userId,
        },
      });
      const openIds = openIdRecords.map((record) => record.openId);
      if (openIds.length === 0) {
        return {
          settledAmountLi: 0n,
          settledCount: 0,
          userId: input.userId,
        };
      }

      const rows = await tx.rawEcpm.findMany({
        where: {
          openId: {
            in: openIds,
          },
          status: SettlementStatus.PENDING,
        },
      });
      if (rows.length === 0) {
        return {
          settledAmountLi: 0n,
          settledCount: 0,
          userId: input.userId,
        };
      }

      const settledAmountLi = rows.reduce(
        (total, row) => total + row.displayAmountLi,
        0n,
      );
      const rowIds = rows.map((row) => row.id);
      const updated = await tx.rawEcpm.updateMany({
        data: {
          status: SettlementStatus.SETTLED,
        },
        where: {
          id: {
            in: rowIds,
          },
          status: SettlementStatus.PENDING,
        },
      });

      if (updated.count === 0) {
        return {
          settledAmountLi: 0n,
          settledCount: 0,
          userId: input.userId,
        };
      }

      await tx.userAccount.update({
        data: {
          availableBalanceLi: {
            increment: settledAmountLi,
          },
        },
        where: {
          id: input.userId,
        },
      });

      return {
        settledAmountLi,
        settledCount: updated.count,
        userId: input.userId,
      };
    });
  }
}
