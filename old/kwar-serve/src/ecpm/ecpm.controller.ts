import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { EcpmService } from './ecpm.service';
import { createEcpm } from './dto/create-ecpm.dto';
import { FindByGameDto } from './dto/find-game.dto';
import { FindByUserDto } from './dto/find-user.dto';
import { FindEcpmDto } from './dto/find-ecpm.dto';
import { RefreshEcpmDto } from './dto/refresh-ecpm.dto';
import { DeleteGameDto } from './dto/delete-game.dto';
import { PushEcpmDto } from './dto/push-ecpm.dto';

@Controller('ecpm')
export class EcpmController {
  constructor(private readonly ecpmService: EcpmService) {}

  @Post('create')
  async create(@Body() createEcpm: createEcpm) {
    return await this.ecpmService.create(createEcpm);
  }

  @Post('refresh')
  async refresh(@Body() refreshEcpmDto: RefreshEcpmDto) {
    return await this.ecpmService.refreshEcpm(refreshEcpmDto);
  }

  @Post('delete-game')
  async deleteGame(@Body() deleteGameDto: DeleteGameDto) {
    return await this.ecpmService.deleteGame(deleteGameDto);
  }

  @Get('refresh-game')
  async refreshGame(@Query('app_id') app_id: string) {
    return await this.ecpmService.refreshGame(app_id);
  }

  @Get('refresh-all')
  async refreshAll() {
    await this.ecpmService.refreshAll();
  }

  @Get('ecpm-game')
  async ecpmGame(@Body() findGame: FindByGameDto) {
    return await this.ecpmService.findByGame(findGame);
  }

  @Get('ecpm-user')
  async ecpmUser(@Body() findUser: FindByUserDto) {
    return await this.ecpmService.findByUser(findUser);
  }

  @Post()
  async findEcpm(@Body() findEcpmDto: FindEcpmDto) {
    return await this.ecpmService.findEcpm(findEcpmDto);
  }

  @Get('check')
  async check() {
    return await this.ecpmService.createWithdraw();
  }

  @Get('delete')
  async delete(@Query('nickname') nickname: string) {
    return await this.ecpmService.deleteEcpm(nickname);
  }

  @Post('delete-all-game')
  async deleteAllGame(@Query('date') date: string) {
    return await this.ecpmService.deleteAllGame(date);
  }

  @Post('max-cost')
  async maxCost(@Query('max_cost') max_cost: number) {
    return await this.ecpmService.maxCost(max_cost);
  }

  @Get('push-ecpm')
  async pushEcpm(@Query() pushEcpmDto: PushEcpmDto) {
    return await this.ecpmService.pushEcpm(pushEcpmDto);
  }
}
