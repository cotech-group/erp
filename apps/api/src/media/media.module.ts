import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { MediaService } from './media.service.js';
import { MediaController } from './media.controller.js';

@Module({
  imports: [
    MulterModule.register({
      storage: undefined, // memory storage by default
    }),
  ],
  controllers: [MediaController],
  providers: [MediaService],
  exports: [MediaService],
})
export class MediaModule {}
