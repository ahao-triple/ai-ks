/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { BadRequestException, Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { Acting } from './acting.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { AddDto } from './dto/add.dto';
import { generateActingId } from 'src/common/helpers/helpers';
import { UpdateDto } from './dto/update.dto';
import { FilterDto } from './dto/filter.dto';
import { DetailDto } from './dto/detail.dto';
import { User } from 'src/user/user.entity';
import { Ecpm } from 'src/ecpm/ecpm.entity';
import { UserService } from 'src/user/user.service';

@Injectable()
export class ActingService {
  constructor(
    @InjectRepository(Acting)
    private readonly actingRepository: Repository<Acting>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Ecpm)
    private readonly ecpmRepository: Repository<Ecpm>,
    private readonly userService: UserService,
  ) {}

  async findAll(): Promise<Acting[]> {
    return this.actingRepository.find();
  }

  async create(addDto: AddDto): Promise<Acting> {
    if (await this.userService.isAdmin(addDto.nickname)) {
      const {
        name,
        scale,
        acting_alipay_login,
        acting_alipay_name,
        withdraw_type,
        acting_level,
        acting_top_id,
      } = addDto;
      const acting_id = generateActingId();

      // 检查 name 是否重复
      const existingName = await this.actingRepository.findOne({
        where: { name },
      });
      if (existingName) {
        throw new BadRequestException('代理名称已存在');
      }
      // 检查 acting_id 是否重复（理论上不会重复，但保险起见）
      const existingId = await this.actingRepository.findOne({
        where: { acting_id },
      });
      if (existingId) {
        throw new BadRequestException('代理ID已存在，请重试');
      }

      const acting = this.actingRepository.create({
        name,
        scale,
        acting_id,
        acting_alipay_login,
        acting_alipay_name,
        withdraw_type,
        acting_level,
        acting_top_id,
      });
      return await this.actingRepository.save(acting);
    } else {
      throw new BadRequestException('失败');
    }
  }

  async update(updateDto: UpdateDto): Promise<Acting> {
    const {
      acting_id,
      name,
      scale,
      acting_alipay_login,
      acting_alipay_name,
      withdraw_type,
      acting_level,
    } = updateDto;
    // 检查 acting_id 是否存在
    const existingActing = await this.actingRepository.findOne({
      where: { acting_id },
    });
    if (!existingActing) {
      throw new BadRequestException('代理ID不存在');
    }
    // 检查 name 是否重复
    const existingName = await this.actingRepository.findOne({
      where: { name },
    });
    if (existingName && existingName.id !== existingActing.id) {
      throw new BadRequestException('代理名称已存在');
    }
    // 更新代理信息
    existingActing.name = name;
    existingActing.scale = scale;
    existingActing.acting_alipay_login = acting_alipay_login;
    existingActing.acting_alipay_name = acting_alipay_name;
    existingActing.withdraw_type = withdraw_type;
    existingActing.acting_level = acting_level;
    return await this.actingRepository.save(existingActing);
  }

  async filter(filterDto: FilterDto): Promise<Acting[]> {
    const { acting_id } = filterDto;
    const actings = await this.actingRepository.find({
      where: { acting_id },
    });
    if (actings.length === 0) {
      throw new BadRequestException('代理代码不存在');
    }
    return actings;
  }

  async detail(data: DetailDto): Promise<any> {
    const { acting_id, start_time, end_time } = data;
    const result: {
      total_people: number;
      total_cost: number;
      scale: number;
      users: User[];
    } = {
      total_people: 0,
      total_cost: 0,
      scale: 0,
      users: [],
    };
    const acting = await this.actingRepository.findOne({
      where: { acting_id },
    });
    if (!acting) {
      throw new BadRequestException('代理代码不存在');
    }

    result.scale = acting.scale;
    const users = await this.userRepository.find({
      where: {
        acting_id,
      },
    });
    result.total_people = users.length;
    let totalCost = 0;

    await Promise.all(
      users.map(async (user) => {
        // 查询该用户，拿到 game_users 字段（类型为 string[]）
        const dbUser = await this.userRepository.findOne({
          where: { nickname: user.nickname },
          select: ['game_users'],
        });

        if (!dbUser?.game_users?.length) return;

        const gameUserNickIds = dbUser.game_users; // string[]

        // 查询 Ecpm 表中符合条件的 cost_client 总和
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const ecpmSumResult = await this.ecpmRepository
          .createQueryBuilder('ecpm')
          .select('SUM(ecpm.cost_client)', 'sum')
          .where('ecpm.nick_id IN (:...ids)', { ids: gameUserNickIds })
          .andWhere('ecpm.event_time BETWEEN :start AND :end', {
            start: start_time,
            end: end_time,
          })
          .getRawOne();

        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        const cost = parseFloat(ecpmSumResult.sum) || 0;
        user.balance_li = cost;
        totalCost += cost;
      }),
    );

    result.total_cost = totalCost;
    result.users = users;
    return result;
  }

  async updateScale(id: number, scale: number): Promise<Acting> {
    const acting = await this.actingRepository.findOne({
      where: { id },
    });
    if (!acting) {
      throw new BadRequestException('代理ID不存在');
    }
    acting.scale = scale;
    return await this.actingRepository.save(acting);
  }
}
