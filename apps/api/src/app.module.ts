import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { DatabaseModule } from './database/database.module.js';
import { AuditModule } from './audit/audit.module.js';
import { AuthModule } from './auth/auth.module.js';
import { StorageModule } from './storage/storage.module.js';
import { MessagingModule } from './messaging/messaging.module.js';
import { MediaModule } from './media/media.module.js';
import { DocumentsModule } from './documents/documents.module.js';
import { WorkflowModule } from './workflow/workflow.module.js';
import { ObservabilityModule } from './observability/observability.module.js';
import { TraceMiddleware } from './observability/trace.middleware.js';
import { HealthController } from './health/health.controller.js';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      { name: 'short', ttl: 1000, limit: 20 },   // 20 req/s
      { name: 'medium', ttl: 60000, limit: 100 }, // 100 req/min
    ]),
    ObservabilityModule,
    DatabaseModule,
    AuditModule,
    AuthModule,
    StorageModule,
    MessagingModule,
    MediaModule,
    DocumentsModule,
    WorkflowModule,
  ],
  controllers: [HealthController],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TraceMiddleware).forRoutes('*');
  }
}
