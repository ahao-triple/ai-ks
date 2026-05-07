import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../user/user.entity';
import { LoginDto } from './dto/login.dto/login.dto';
import * as bcrypt from 'bcryptjs'; // 替换这一行

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private jwtService: JwtService,
  ) {}

  async login(loginDto: LoginDto) {
    const { username, password } = loginDto;

    // 查找用户
    const user = await this.userRepository.findOne({
      where: { nickname: username },
    });

    if (!user) {
      throw new BadRequestException('用户不存在，请注册！');
    }

    // 验证密码
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      throw new InternalServerErrorException('密码错误');
    }

    // 生成JWT令牌
    const payload = { username: user.nickname, sub: user.id };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        nickname: user.nickname,
      },
      identity: user.identity,
    };
  }
}
