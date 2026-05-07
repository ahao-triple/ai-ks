import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Put,
  ValidationPipe,
} from '@nestjs/common';
import { GameService } from './game.service';
import { CreateGameDto } from './dto/create-game.dto';
import { Game } from './game.entity';
import { UpdateScaleDto } from './dto/update-scale.dto';
import { UpdateIsWithdrawDto } from './dto/update-is-withdraw.dto';

@Controller('game')
export class GameController {
  constructor(private readonly gameService: GameService) {}

  @Post()
  async create(
    @Body(ValidationPipe)
    createGameDto: CreateGameDto,
  ): Promise<Game> {
    return this.gameService.create(createGameDto);
  }

  @Get()
  async findAll(): Promise<Game[]> {
    return this.gameService.findAll();
  }

  @Put('scale')
  async updateScale(@Body() updateScaleDto: UpdateScaleDto): Promise<any> {
    return await this.gameService.updateScale(updateScaleDto);
  }

  @Put('is-withdraw')
  async updateIsWithdraw(
    @Body() updateIsWithdrawDto: UpdateIsWithdrawDto,
  ): Promise<any> {
    return await this.gameService.updateIsWithdraw(updateIsWithdrawDto);
  }

  @Get('names')
  async findAllName(): Promise<{ name: string; app_id: string }[]> {
    return this.gameService.findAllName();
  }

  @Get(':app_id')
  async findOne(@Param('app_id') app_id: string): Promise<Game> {
    return this.gameService.findOne(app_id);
  }

  @Put(':app_id')
  async update(
    @Param('app_id') app_id: string,
    @Body() updateGameDto: Partial<CreateGameDto>,
  ): Promise<Game> {
    return this.gameService.update(app_id, updateGameDto);
  }

  @Delete(':app_id')
  async remove(@Param('app_id') app_id: string): Promise<void> {
    return this.gameService.remove(app_id);
  }

  @Post('enforce-client')
  async enforce(@Body('app_id') app_id: string): Promise<boolean> {
    return this.gameService.enforce(app_id);
  }

  @Post('enforce-game')
  async enforceGame(@Body('app_id') app_id: string): Promise<boolean> {
    return this.gameService.enforceGame(app_id);
  }
}
