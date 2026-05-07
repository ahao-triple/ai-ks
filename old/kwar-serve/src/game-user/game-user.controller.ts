import { Body, Controller, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { GameUserService } from './game-user.service';
import { GameUserLoginDto } from './dto/game-user-login.dto';
import { getClientIp } from 'src/common/helpers/helpers';
import { OpenVideoDto } from './dto/open-video.dto';
import { CloseVideoDto } from './dto/close-video.dto';

@Controller('game-user')
export class GameUserController {
  constructor(private readonly gameUserService: GameUserService) {}

  @Post('login')
  async gameUserLogin(
    @Req() req: Request,
    @Body() gameUserLogin: GameUserLoginDto,
  ) {
    // 从请求头获取 IP（优先考虑 x-forwarded-for）
    const ip: string = getClientIp(req);
    gameUserLogin.ip = ip;
    return this.gameUserService.login(gameUserLogin);
  }

  @Post('open-video')
  async openVideo(@Body() openVideoDto: OpenVideoDto) {
    return await this.gameUserService.openVideo(openVideoDto);
  }

  @Post('close-video')
  async closeVideo(@Body() closeVideoDto: CloseVideoDto) {
    return await this.gameUserService.closeVideo(closeVideoDto);
  }
}
