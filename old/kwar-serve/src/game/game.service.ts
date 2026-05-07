import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Game } from './game.entity';
import { CreateGameDto } from './dto/create-game.dto';
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { UpdateScaleDto } from './dto/update-scale.dto';
import { UpdateIsWithdrawDto } from './dto/update-is-withdraw.dto';
import { UserService } from 'src/user/user.service';

@Injectable()
export class GameService {
  constructor(
    @InjectRepository(Game)
    private readonly gameRepository: Repository<Game>,
    private readonly userService: UserService,
  ) {}

  async create(createGameDto: CreateGameDto): Promise<Game> {
    if (await this.userService.isAdmin(createGameDto.nickname)) {
      const game = this.gameRepository.create(createGameDto);

      try {
        const savedGame = await this.gameRepository.save(game);
        return savedGame;
      } catch (error: any) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        if (error.code === '23505') {
          throw new BadRequestException(
            `游戏 app_id "${createGameDto.app_id}" 已存在`,
          );
        }
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        Logger.error(`保存游戏失败: ${error.message}`, error.stack);
        throw new InternalServerErrorException('创建游戏失败，请稍后重试');
      }
    } else {
      throw new InternalServerErrorException('创建游戏失败，请稍后重试');
    }
  }

  async findAll(): Promise<Game[]> {
    return await this.gameRepository.find({
      order: {
        id: 'ASC',
      },
    });
  }

  async findAllName(): Promise<{ name: string; app_id: string }[]> {
    return await this.gameRepository.find({
      select: ['name', 'app_id'],
    });
  }

  async findOne(app_id: string): Promise<Game> {
    const game = await this.gameRepository.findOne({ where: { app_id } });
    if (!game) {
      throw new NotFoundException(`没有找到${app_id}这个游戏`);
    }
    return game;
  }

  async update(
    app_id: string,
    updateGameDto: Partial<CreateGameDto>,
  ): Promise<Game> {
    await this.gameRepository.update(app_id, updateGameDto);
    return this.findOne(app_id);
  }

  async remove(app_id: string): Promise<void> {
    await this.gameRepository.delete(app_id);
  }

  async updateScale(data: UpdateScaleDto): Promise<any> {
    const { app_id, scale, nickname } = data;
    if (await this.userService.isAdmin(nickname)) {
      return await this.gameRepository.update({ app_id }, { scale });
    }
  }

  async updateIsWithdraw(data: UpdateIsWithdrawDto): Promise<any> {
    const { app_id, isWithdraw, nickname } = data;

    if (await this.userService.isAdmin(nickname)) {
      return await this.gameRepository.update(
        { app_id },
        { is_withdraw: isWithdraw },
      );
    }
  }

  async enforce(app_id: string): Promise<boolean> {
    console.log(' app_id ', app_id);
    const game = await this.findOne(app_id);
    if (!game) {
      throw new NotFoundException(`没有找到${app_id}这个游戏`);
    }
    if (game.enforce) {
      return true;
    } else {
      return false;
    }
  }

  async enforceGame(app_id: string): Promise<boolean> {
    const game = await this.findOne(app_id);
    if (!game) {
      throw new NotFoundException(`没有找到${app_id}这个游戏`);
    }
    game.enforce = !game.enforce;
    await this.gameRepository.save(game);
    return true;
  }
}
