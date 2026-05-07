import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from './user.entity';
import { Repository } from 'typeorm';
import { CreateUserDto } from './dto/create-user.dto';
import * as bcrypt from 'bcryptjs';
import { BindingUserDto } from './dto/binding-user.dto';
import { GameUser } from 'src/game-user/game-user.entity';
import { FindBindingDto } from './dto/find-binding.dto';
import { GrantUserDto } from './dto/grant-user.dto';
import { WithdrawInfoDto } from './dto/withdraw-info.dto';
import { IdentityUserDto } from './dto/identity-user.dto';
import { BindingActingDto } from './dto/binding-acting.dts';
import { SelectDto } from './dto/select.dto';
import { WithdrawService } from 'src/withdraw/withdraw.service';
import { Inject, forwardRef } from '@nestjs/common';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(GameUser)
    private gameUserRepository: Repository<GameUser>,
    @Inject(forwardRef(() => WithdrawService))
    private withdrawService: WithdrawService,
  ) {}

  /**
   * 根据 nickname 获取用户信息
   * @param nickname
   * @returns
   */
  async getUser(nickname: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { nickname: nickname },
    });
    if (!user) {
      throw new BadRequestException('用户不存在');
    }
    return user;
  }

  /**
   * 用户注册
   * @param createUserDto
   * @returns
   */
  async create(createUserDto: CreateUserDto): Promise<User> {
    const { username, password, acting_id } = createUserDto;

    // 检查用户是否存在
    const existingUser = await this.userRepository.findOne({
      where: { nickname: username },
    });

    if (existingUser) {
      throw new BadRequestException('用户名已占用');
    }

    // 对密码进行哈希处理
    const hashedPassword = await bcrypt.hash(password, 10);

    // 创建用户实体
    const user = this.userRepository.create({
      nickname: username,
      password: hashedPassword,
      acting_id: acting_id,
    });

    await this.userRepository.save(user);

    return user;
  }

  /**
   * 绑定游戏账号
   * @param data
   * @returns
   */
  async bindingUser(data: BindingUserDto): Promise<boolean> {
    const { username, nick_id } = data;
    // 检查用户是否存在
    const existingUser = await this.userRepository.findOne({
      where: { nickname: username },
    });
    if (!existingUser) {
      throw new BadRequestException('用户不存在');
    }
    const existingBinding = await this.gameUserRepository.findOne({
      where: { nick_id },
      select: ['bindingUser'],
    });
    if (existingBinding?.bindingUser) {
      throw new BadRequestException('该NickID已绑定');
    }

    if (nick_id.length >= 6) {
      const existing_game_user = await this.gameUserRepository.findOne({
        where: { nick_id },
      });
      if (!existing_game_user) {
        throw new BadRequestException('NickID不存在');
      }
      await this.gameUserRepository.update(
        { nick_id },
        { bindingUser: username },
      );
      try {
        await this.userRepository
          .createQueryBuilder()
          .update()
          .set({
            game_users: () => `array_append(game_users, '${nick_id}')`,
          })
          .where('nickname = :username', { username })
          .execute();

        return true;
      } catch (e) {
        Logger.error(e, '绑定失败');
        throw new InternalServerErrorException('绑定失败');
      }
    } else {
      throw new BadRequestException('NickID长度不足');
    }
  }

  /**
   * 查找用户绑定的NickID
   * @param findBindingDto
   * @returns
   */
  async findBinding(findBindingDto: FindBindingDto): Promise<string[]> {
    const db_result = await this.userRepository.findOne({
      where: { nickname: findBindingDto.username },
      select: ['game_users'],
    });
    if (db_result?.game_users) {
      return db_result.game_users;
    } else {
      return [];
    }
  }

  /**
   * 修改用户权限为管理员
   * @param grantDto
   * @returns
   */
  async granUser(grantDto: GrantUserDto): Promise<boolean> {
    const user = await this.userRepository.findOne({
      where: { nickname: grantDto.username },
    });
    if (!user) {
      throw new InternalServerErrorException('用户不存在');
    } else {
      await this.userRepository.update(
        { nickname: grantDto.username },
        { identity: 'admin' },
      );
      return true;
    }
  }

  /**
   * 判断用户权限
   */
  async isAdmin(nickname: string): Promise<boolean> {
    const user = await this.userRepository.findOne({
      where: { nickname: nickname },
    });

    if (!user) {
      throw new InternalServerErrorException('用户不存在');
    } else {
      if (user.identity === 'ahaotriple' || user.identity === 'super') {
        return true;
      } else {
        return false;
      }
    }
  }

  /**
   * 修改用户提现信息
   * @param addWithdrawDto
   * @returns
   */
  async addWithdrawInfo(addWithdrawDto: WithdrawInfoDto): Promise<boolean> {
    const { nickname, alipay, name } = addWithdrawDto;
    const user = await this.userRepository.findOne({
      where: { nickname: nickname },
    });
    if (!user) {
      throw new BadRequestException('用户不存在');
    }

    try {
      user.withdraw_info.alipay = alipay;
      user.withdraw_info.name = name;
      await this.userRepository.save(user);
      return true;
    } catch (e) {
      Logger.error(`添加提现信息失败:${e}`);
      throw new InternalServerErrorException('添加失败');
    }
  }

  /**
   * 获取用户提现信息
   * @param nickname
   * @returns
   */
  async getWithdrawInfo(nickname: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { nickname: nickname },
    });
    if (!user) {
      throw new BadRequestException('用户不存在');
    }
    return user;
  }

  async selectUsers(
    query: SelectDto,
  ): Promise<{ data: User[]; total: number }> {
    const {
      page,
      pageSize,
      game_users,
      nickname,
      acting_id,
      withdraw_name,
      withdraw_alipay,
    } = query;

    Logger.log(query);

    const qb = this.userRepository.createQueryBuilder('user');

    if (game_users) {
      qb.andWhere(':game_user = ANY(user.game_users)', {
        game_user: game_users,
      });
    }

    if (nickname) {
      qb.andWhere('user.nickname ILIKE :nickname', {
        nickname: `%${nickname}%`,
      });
    }

    if (acting_id) {
      qb.andWhere('user.acting_id = :acting_id', { acting_id });
    }

    if (withdraw_name) {
      qb.andWhere(`user.withdraw_info ->> 'name' ILIKE :withdraw_name`, {
        withdraw_name: `%${withdraw_name}%`,
      });
    }

    if (withdraw_alipay) {
      qb.andWhere(`user.withdraw_info ->> 'alipay' ILIKE :withdraw_alipay`, {
        withdraw_alipay: `%${withdraw_alipay}%`,
      });
    }

    qb.skip((page - 1) * pageSize)
      .take(pageSize)
      .orderBy('user.createdAt', 'DESC');

    const [data, total] = await qb.getManyAndCount();

    return { data, total };
  }
  /**
   * 重制密码
   */
  async resetPassword(nickname: string): Promise<boolean> {
    const user = await this.userRepository.findOne({
      where: { nickname: nickname },
    });
    if (!user) {
      throw new BadRequestException('用户不存在');
    }
    const hashedPassword = await bcrypt.hash('123456', 10);
    user.password = hashedPassword;
    await this.userRepository.save(user);
    return true;
  }

  async getUserInfo(id: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id: Number(id) },
    });
    if (!user) {
      throw new BadRequestException('用户不存在');
    }
    return user;
  }

  async addBlacklist(id: string): Promise<boolean> {
    const user = await this.userRepository.findOne({
      where: { id: Number(id) },
    });
    if (!user) {
      throw new BadRequestException('用户不存在');
    }
    user.identity = 'blacklist';
    await this.userRepository.save(user);
    return true;
  }

  async updateIdentity(identityDto: IdentityUserDto): Promise<boolean> {
    const { id, identity, nickname } = identityDto;
    if (await this.isAdmin(nickname)) {
      const user = await this.userRepository.findOne({
        where: { id: Number(id) },
      });
      if (!user) {
        throw new BadRequestException('用户不存在');
      }
      user.identity = identity;
      await this.userRepository.save(user);
      return true;
    } else {
      return false;
    }
  }

  async bindingActing(dto: BindingActingDto): Promise<boolean> {
    const user = await this.userRepository.findOne({
      where: { nickname: dto.username },
    });
    if (!user) {
      throw new BadRequestException('用户不存在');
    }
    user.acting_id = dto.acting_id;
    await this.userRepository.save(user);
    return true;
  }

  async getActingId(nickname: string): Promise<string> {
    const user = await this.userRepository.findOne({
      where: { nickname: nickname },
    });
    if (!user) {
      throw new BadRequestException('用户不存在');
    }
    return user.acting_id;
  }

  async clear(): Promise<{ success: boolean; message: string }> {
    const queryRunner =
      this.userRepository.manager.connection.createQueryRunner();

    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 将所有用户的frozen、balance、withdraw_total、total字段重置为0.0
      await queryRunner.manager
        .createQueryBuilder()
        .update(User)
        .set({
          frozen: 0.0,
          balance: 0.0,
          withdraw_total: 0.0,
          total: 0.0,
        })
        .execute();

      // 清空提现表
      await this.withdrawService.clearWithdraw(queryRunner);

      await queryRunner.commitTransaction();

      return {
        success: true,
        message: '用户余额重置和提现记录清空操作成功完成',
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      Logger.error(`清空用户数据失败: ${error}`);

      return {
        success: false,
        message: `清空用户数据失败: ${error}`,
      };
    } finally {
      await queryRunner.release();
    }
  }
}
