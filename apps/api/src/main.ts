import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { resolveConfiguredPort } from './common/env/port';
import { ApiExceptionFilter } from './common/errors/api-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: true,
  });
  app.useGlobalFilters(new ApiExceptionFilter());
  app.setGlobalPrefix('api');
  const port = resolveConfiguredPort({
    defaultPort: 3000,
    env: process.env,
    name: 'API_PORT',
  });
  await app.listen(port);
}

void bootstrap();
