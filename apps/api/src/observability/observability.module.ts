import { Global, Module } from '@nestjs/common';
import { createLogger } from '@ina-erp/observability';
import { MetricsService } from './metrics.service.js';
import { MetricsController } from './metrics.controller.js';
import { LoggingInterceptor } from './logging.interceptor.js';
import { MetricsInterceptor } from './metrics.interceptor.js';

const logger = createLogger('ina-api');

@Global()
@Module({
  controllers: [MetricsController],
  providers: [
    { provide: 'APP_LOGGER', useValue: logger },
    MetricsService,
    LoggingInterceptor,
    MetricsInterceptor,
  ],
  exports: ['APP_LOGGER', MetricsService, LoggingInterceptor, MetricsInterceptor],
})
export class ObservabilityModule {}
