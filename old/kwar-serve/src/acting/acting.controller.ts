import { Body, Controller, Get, Post, Put, Query } from '@nestjs/common';
import { Acting } from './acting.entity';
import { ActingService } from './acting.service';
import { AddDto } from './dto/add.dto';
import { UpdateDto } from './dto/update.dto';
import { FilterDto } from './dto/filter.dto';
import { DetailDto } from './dto/detail.dto';

@Controller('acting')
export class ActingController {
  constructor(private readonly actingService: ActingService) {}

  @Get()
  async findAll(): Promise<Acting[]> {
    return await this.actingService.findAll();
  }

  @Post()
  async add(@Body() addDto: AddDto): Promise<Acting> {
    return await this.actingService.create(addDto);
  }

  @Put()
  async update(@Body() updateDto: UpdateDto): Promise<Acting> {
    return await this.actingService.update(updateDto);
  }

  @Get('filter')
  async filter(@Body() filterDto: FilterDto): Promise<Acting[]> {
    return await this.actingService.filter(filterDto);
  }

  @Get('detail')
  async detail(@Query() detailDto: DetailDto): Promise<any> {
    return await this.actingService.detail(detailDto);
  }

  @Put('scale')
  async updateScale(
    @Query('id') id: number,
    @Query('scale') scale: number,
  ): Promise<Acting> {
    return await this.actingService.updateScale(id, scale);
  }
}
