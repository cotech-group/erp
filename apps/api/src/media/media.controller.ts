import {
  Controller,
  Post,
  Get,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { MediaService } from './media.service.js';
import { UploadMediaDto, MediaQueryDto } from './dto/index.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { JwtPayload } from '../auth/auth.service.js';
import type { MediaStatus } from '../generated/prisma/client.js';

// BigInt JSON serialization
(BigInt.prototype as any).toJSON = function () {
  return Number(this);
};

@Controller('media')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post('upload')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 500 * 1024 * 1024 } })) // 500MB max
  async upload(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: UploadMediaDto,
    @CurrentUser() user: JwtPayload,
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    const media = await this.mediaService.upload(dto, file, user.sub);
    return {
      data: media,
      meta: { timestamp: new Date().toISOString() },
    };
  }

  @Get()
  async findAll(@Query() query: MediaQueryDto) {
    const { data, total } = await this.mediaService.findAll(query);
    return {
      data,
      meta: {
        total,
        page: Number(query.page) || 1,
        limit: Math.min(Number(query.limit) || 20, 100),
        timestamp: new Date().toISOString(),
      },
    };
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const media = await this.mediaService.findOne(id);
    return {
      data: media,
      meta: { timestamp: new Date().toISOString() },
    };
  }

  @Patch(':id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body('status') status: MediaStatus,
    @CurrentUser() user: JwtPayload,
  ) {
    const media = await this.mediaService.updateStatus(id, status, user.sub);
    return {
      data: media,
      meta: { timestamp: new Date().toISOString() },
    };
  }
}
