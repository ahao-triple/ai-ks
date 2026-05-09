import { Controller, Get, UseGuards } from '@nestjs/common';
import { AdminJwtGuard } from '../admin-auth/admin-jwt.guard';
import { SuperAdminGuard } from '../admin-auth/super-admin.guard';
import {
  BusinessClosureService,
  type BusinessClosureReport,
} from './business-closure.service';

@Controller('admin/business-closure')
@UseGuards(AdminJwtGuard, SuperAdminGuard)
export class BusinessClosureController {
  constructor(
    private readonly businessClosureService: BusinessClosureService,
  ) {}

  @Get()
  async getReport() {
    const report = await this.businessClosureService.getReport();

    return presentReport(report);
  }
}

function presentReport(report: BusinessClosureReport) {
  return {
    checks: report.checks,
    metrics: {
      ...report.metrics,
      gameBudgetLi: report.metrics.gameBudgetLi.toString(),
    },
    summary: report.summary,
  };
}
