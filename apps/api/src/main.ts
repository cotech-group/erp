import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { createLogger } from '@ina-erp/observability';
import { LoggingInterceptor } from './observability/logging.interceptor';
import { MetricsInterceptor } from './observability/metrics.interceptor';
import { GlobalExceptionFilter } from './observability/http-exception.filter';

async function bootstrap() {
  const logger = createLogger('ina-api');

  const app = await NestFactory.create(AppModule, {
    logger: false, // use pino instead of default NestJS logger
  });

  app.setGlobalPrefix('api/v1', {
    exclude: ['metrics'],
  });

  // Global observability
  app.useGlobalInterceptors(
    app.get(LoggingInterceptor),
    app.get(MetricsInterceptor),
  );
  app.useGlobalFilters(new GlobalExceptionFilter(logger));

  const port = process.env['API_PORT'] || 3001;
  await app.listen(port);
  logger.info({ port }, `API running on http://localhost:${port}/api/v1`);
}

bootstrap();
