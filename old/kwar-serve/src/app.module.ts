import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UserModule } from './user/user.module';
import { envConfig } from './config/config';
import { GameUserModule } from './game-user/game-user.module';
import { AuthModule } from './auth/auth.module';
import { LoggingMiddleware } from './logging.middleware';
import { GameModule } from './game/game.module';
import { CompanyModule } from './company/company.module';
import { EcpmModule } from './ecpm/ecpm.module';
import { WithdrawModule } from './withdraw/withdraw.module';
import { AlipayModule } from './alipay/alipay.module';
import { ActingModule } from './acting/acting.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: envConfig.database.type as 'postgres',
      host: envConfig.database.host,
      port: envConfig.database.port,
      username: envConfig.database.username,
      password: envConfig.database.password,
      database: envConfig.database.database,
      entities: [__dirname + '/**/*.entity{.ts,.js}'],
      synchronize: true, // 开发环境使用，生产环境建议关闭
    }),
    UserModule,
    GameUserModule,
    AuthModule,
    GameModule,
    CompanyModule,
    EcpmModule,
    WithdrawModule,
    AlipayModule,
    ActingModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(LoggingMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
