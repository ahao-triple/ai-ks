import { Body, Controller, Post } from '@nestjs/common';
import { z } from 'zod';
import { GameSessionService } from './game-session.service';

const createGameSessionSchema = z.object({
  gameAppId: z.string().min(1),
  jsCode: z.string().min(1),
});

@Controller('game')
export class GameSessionController {
  constructor(private readonly gameSessionService: GameSessionService) {}

  @Post('sessions')
  async createSession(@Body() body: unknown) {
    const input = createGameSessionSchema.parse(body);
    return this.gameSessionService.createSession(input);
  }
}
