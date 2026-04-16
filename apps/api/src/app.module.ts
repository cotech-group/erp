import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module.js';
import { AuditModule } from './audit/audit.module.js';
import { AuthModule } from './auth/auth.module.js';
import { StorageModule } from './storage/storage.module.js';
import { MessagingModule } from './messaging/messaging.module.js';
import { MediaModule } from './media/media.module.js';
import { DocumentsModule } from './documents/documents.module.js';
import { HealthController } from './health/health.controller.js';

@Module({
  imports: [DatabaseModule, AuditModule, AuthModule, StorageModule, MessagingModule, MediaModule, DocumentsModule],
  controllers: [HealthController],
})
export class AppModule {}
