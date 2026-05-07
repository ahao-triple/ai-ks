import { Body, Controller, Post, Param, Put, Get, Query } from '@nestjs/common';
import { CompanyService } from './company.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { Company } from './company.entity';
import { updateProDto } from './dto/update-pro.dto';

@Controller('company')
export class CompanyController {
  constructor(private readonly companyService: CompanyService) {}

  @Post()
  async create(@Body() createCompanyDto: CreateCompanyDto): Promise<Company> {
    return this.companyService.create(createCompanyDto);
  }

  @Put('token/:app_id')
  async updateToken(@Param('app_id') app_id: string): Promise<boolean> {
    const updateToken = { app_id };
    return this.companyService.updateToken(updateToken);
  }

  @Get()
  async findAll(): Promise<Company[]> {
    return this.companyService.findAll();
  }

  @Put('pro')
  async updatePro(@Body() updatePro: updateProDto): Promise<boolean> {
    return await this.companyService.updatePro(updatePro);
  }

  @Get('create-token')
  async createToken(@Query('auth_code') auth_code: string): Promise<Company> {
    return await this.companyService.createToken(auth_code);
  }

  @Get('pro')
  async getPro(): Promise<number> {
    return await this.companyService.getPro();
  }

  @Get('create-app')
  async createApp(@Query('auth_code') auth_code: string): Promise<string> {
    return await this.companyService.createDefaultCompany(auth_code);
  }

  @Get('refresh-token')
  async refreshToken() {
    return await this.companyService.autoRefresh();
  }

  @Get('is-withdraw')
  async isWithdraw() {
    return await this.companyService.isWithdraw();
  }

  @Get('is-acting')
  async isActing() {
    return await this.companyService.isActing();
  }

  @Get('check-pay')
  async checkPay(@Query('password') password: string) {
    return await this.companyService.checkPay(password);
  }

  @Post('update-pay')
  async updatePay(@Query('password') password: string) {
    return await this.companyService.updatePay(password);
  }
}
