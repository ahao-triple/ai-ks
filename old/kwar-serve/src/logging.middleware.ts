import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class LoggingMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const { method, originalUrl, query, body } = req;
    const ip =
      req.headers['x-forwarded-for']?.toString().split(',')[0] ||
      req.socket.remoteAddress;

    Logger.log(
      [
        '========== 请求信息 ==========\n',
        `📌 路由: ${originalUrl}`,
        `📬 方法: ${method}`,
        `🌐 IP: ${ip}`,
        `🧾 Query 参数: ${JSON.stringify(query, null, 2)}`,
        `📦 请求体: ${JSON.stringify(body, null, 2)}`,
        '==============================',
      ].join('\n'),
    );
    next();
  }
}
