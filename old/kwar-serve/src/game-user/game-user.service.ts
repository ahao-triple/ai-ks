import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GameUser } from './game-user.entity';
import { GameUserLoginDto } from './dto/game-user-login.dto';
import { formatDate, generateNickId } from 'src/common/helpers/helpers';
import { IKwaiLoginData, ILoginRes } from 'src/types/types';
import { HttpService } from '@nestjs/axios';
import { Game } from 'src/game/game.entity';
import { OpenVideoDto } from './dto/open-video.dto';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CloseVideoDto } from './dto/close-video.dto';
import { EcpmService } from 'src/ecpm/ecpm.service';
import { firstValueFrom } from 'rxjs/internal/firstValueFrom';
import { User } from 'src/user/user.entity';

@Injectable()
export class GameUserService {
  constructor(
    @InjectRepository(GameUser)
    private readonly gameUserRepository: Repository<GameUser>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly httpService: HttpService,
    @InjectRepository(Game) // 添加装饰器
    private readonly gameRepository: Repository<Game>,
    private readonly ecpmService: EcpmService,
  ) {}

  // 确保生成的 nick_id 唯一
  private async generateUniqueNickId(): Promise<string> {
    let nickId: string;
    let exists: GameUser | null;
    do {
      nickId = generateNickId();
      exists = await this.gameUserRepository.findOne({
        where: { nick_id: nickId },
      });
    } while (exists !== null);
    return nickId;
  }

  async login(loginDto: GameUserLoginDto): Promise<ILoginRes> {
    const secret = await this.getSecret(loginDto.app_id);
    const open_id = await this.getOpenID({
      app_id: loginDto.app_id,
      app_secret: secret,
      js_code: loginDto.code,
      grant_type: 'authorization_code',
    });
    let user = await this.gameUserRepository.findOne({
      where: { open_id: open_id },
    });

    if (!user) {
      // 用户不存在，创建新用户
      const nick_id = await this.generateUniqueNickId();
      user = this.gameUserRepository.create({
        nick_id: nick_id,
        open_id: open_id,
        app_id: loginDto.app_id,
        code: loginDto.code,
        ip: loginDto.ip,
        systemData: loginDto.systemData,
      });
      user = await this.gameUserRepository.save(user);
    } else {
      // 用户已存在，更新最新的登录信息
      user.ip = loginDto.ip;
      user.systemData = loginDto.systemData;
      user = await this.gameUserRepository.save(user);
    }
    const video_id = await this.getVideoID(user.app_id);
    return {
      open_id: user.open_id,
      video_id: video_id,
      nick_id: user.nick_id,
    };
  }

  async getOpenID(data: IKwaiLoginData): Promise<string> {
    const endpoint = 'https://open.kuaishou.com/game/minigame/jscode2session';
    try {
      const response = await firstValueFrom(
        this.httpService.get(endpoint, { params: data }),
      );
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (response.data.result !== 1) {
        Logger.error(
          '获取 open_id 错误',
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          JSON.stringify(response.data.message),
        );
        throw new InternalServerErrorException(
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          `获取 open_id 错误${response.data.message}`,
        );
      } else {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        return response.data.open_id as string;
      }
    } catch (error) {
      Logger.error('获取 open_id 未知错误错误', JSON.stringify(error));
      throw new InternalServerErrorException(`获取 open_id 错误${error}`);
    }
  }

  async closeVideo(closeVideoDto: CloseVideoDto): Promise<boolean> {
    const { open_id } = closeVideoDto;
    const video_times = await this.getVideoTimes(open_id);
    await this.gameUserRepository.update(
      { open_id },
      { video_times: video_times + 1 },
    );
    await this.ecpmService.create({
      app_id: closeVideoDto.app_id,
      open_id: closeVideoDto.open_id,
      data_hour: formatDate(new Date()),
    });
    return true;
  }

  async getSecret(app_id: string): Promise<string> {
    const result = await this.gameRepository.findOneOrFail({
      where: { app_id },
      select: ['secret'],
    });
    return result.secret;
  }

  async checkVideo(open_id: string): Promise<boolean> {
    const game_user = await this.gameUserRepository.findOne({
      where: { open_id },
      select: ['last_open_time'],
    });

    if (game_user && game_user.last_open_time) {
      const now = new Date();
      const lastOpenTime = new Date(game_user.last_open_time);
      const timeDiff = (now.getTime() - lastOpenTime.getTime()) / 1000;
      if (timeDiff < 30) {
        return false;
      } else {
        await this.gameUserRepository.update(
          { open_id },
          { last_open_time: new Date() },
        );
        return true;
      }
    } else {
      await this.gameUserRepository.update(
        { open_id },
        { last_open_time: new Date() },
      );
      return true;
    }
  }

  async openVideo(openVideoDto: OpenVideoDto): Promise<boolean> {
    return true;
    // const { app_id, open_id } = openVideoDto;
    // const video_max = await this.getVideoMax(app_id);
    // const video_times = await this.getVideoTimes(open_id);
    // if (await this.isBlack(open_id)) return false;
    // if (video_times < video_max) {
    //   return await this.checkVideo(open_id);
    // } else {
    //   return false;
    // }
  }

  async isBlack(open_id: string): Promise<boolean> {
    const game_user = await this.gameUserRepository.findOne({
      where: { open_id },
    });
    if (game_user && game_user.bindingUser) {
      const user = await this.userRepository.findOne({
        where: { nickname: game_user.bindingUser },
      });
      if (user && user.identity === 'blacklist') {
        return true;
      }
    }
    return false;
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT) // 每天00:00执行
  async resetVideoTimes() {
    await this.gameUserRepository.update({}, { video_times: 0 }); // 重置所有记录
  }

  async getVideoTimes(open_id: string): Promise<number> {
    const entity = await this.gameUserRepository.findOneOrFail({
      where: { open_id },
      select: ['video_times'], // 只选择 video_times 字段
    });
    return entity.video_times; // 直接返回 number
  }

  async getVideoMax(app_id: string): Promise<number> {
    const entity = await this.gameRepository.findOneOrFail({
      where: { app_id },
      select: ['limit'], // 只选择 video_times 字段
    });
    return entity.limit.video_max; // 直接返回 number
  }

  async getVideoID(app_id: string): Promise<string> {
    const entity = await this.gameRepository.findOneOrFail({
      where: { app_id },
      select: ['limit'],
    });
    return entity.limit.video_id;
  }
}
