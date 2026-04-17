import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import compression from 'compression';
import { AppModule } from './app.module';
import { createLogger } from '@ina-erp/observability';
import { LoggingInterceptor } from './observability/logging.interceptor';
import { MetricsInterceptor } from './observability/metrics.interceptor';
import { CacheControlInterceptor } from './observability/cache-control.interceptor';
import { GlobalExceptionFilter } from './observability/http-exception.filter';

async function bootstrap() {
  const logger = createLogger('ina-api');

  const app = await NestFactory.create(AppModule, {
    logger: false,
  });

  // Performance
  app.use(compression());

  // Security
  app.use(helmet());
  app.enableCors({
    origin: process.env['CORS_ORIGIN'] || 'http://localhost:3000',
    credentials: true,
  });

  // Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,        // strip unknown properties
      forbidNonWhitelisted: true, // throw on unknown properties
      transform: true,        // auto-transform payloads to DTO instances
    }),
  );

  app.setGlobalPrefix('api/v1', {
    exclude: ['metrics'],
  });

  // Swagger / OpenAPI
  const swaggerConfig = new DocumentBuilder()
    .setTitle('INA ERP API')
    .setDescription('API Gateway pour la plateforme ERP INA')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  // Observability
  app.useGlobalInterceptors(
    app.get(LoggingInterceptor),
    app.get(MetricsInterceptor),
    app.get(CacheControlInterceptor),
  );
  app.useGlobalFilters(new GlobalExceptionFilter(logger));

  const port = process.env['API_PORT'] || 3001;
  await app.listen(port);
  logger.info({ port }, `API running on http://localhost:${port}/api/v1`);
  logger.info({ port }, `Swagger docs on http://localhost:${port}/api/docs`);
}

bootstrap().catch((err) => {
  console.error('Failed to start:', err);
  process.exit(1);
});
