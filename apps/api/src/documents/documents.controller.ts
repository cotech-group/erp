import {
  Controller,
  Post,
  Get,
  Patch,
  Param,
  Body,
  Query,
  Res,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  HttpCode,
  HttpStatus,
  BadRequestException,
  ParseIntPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { DocumentsService } from './documents.service.js';
import { CreateDocumentDto, UploadVersionDto, DocumentQueryDto } from './dto/index.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { JwtPayload } from '../auth/auth.service.js';
import type { DocumentStatus } from '../generated/prisma/client.js';

// BigInt JSON serialization
(BigInt.prototype as any).toJSON = function () {
  return Number(this);
};

@Controller('documents')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 100 * 1024 * 1024 } })) // 100MB
  async create(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: CreateDocumentDto,
    @CurrentUser() user: JwtPayload,
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    const doc = await this.documentsService.create(dto, file, user.sub);
    return {
      data: doc,
      meta: { timestamp: new Date().toISOString() },
    };
  }

  @Get()
  async findAll(@Query() query: DocumentQueryDto) {
    const { data, total } = await this.documentsService.findAll(query);
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
    const doc = await this.documentsService.findOne(id);
    return {
      data: doc,
      meta: { timestamp: new Date().toISOString() },
    };
  }

  @Get(':id/versions')
  async getVersions(@Param('id') id: string) {
    const versions = await this.documentsService.getVersions(id);
    return {
      data: versions,
      meta: { timestamp: new Date().toISOString() },
    };
  }

  @Get(':id/versions/:version/download')
  async downloadVersion(
    @Param('id') id: string,
    @Param('version', ParseIntPipe) version: number,
    @Res() res: Response,
  ) {
    const { stream, version: v } = await this.documentsService.downloadVersion(id, version);
    res.set({
      'Content-Type': v.mimeType,
      'Content-Disposition': `attachment; filename="${v.originalName}"`,
    });
    stream.pipe(res);
  }

  @Post(':id/versions')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 100 * 1024 * 1024 } }))
  async uploadVersion(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: UploadVersionDto,
    @CurrentUser() user: JwtPayload,
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    const version = await this.documentsService.uploadVersion(id, dto, file, user.sub);
    return {
      data: version,
      meta: { timestamp: new Date().toISOString() },
    };
  }

  @Patch(':id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body('status') status: DocumentStatus,
    @CurrentUser() user: JwtPayload,
  ) {
    const doc = await this.documentsService.updateStatus(id, status, user.sub);
    return {
      data: doc,
      meta: { timestamp: new Date().toISOString() },
    };
  }
}
