import { Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import { PrismaService } from '../database/prisma.service.js';
import { StorageService } from '../storage/storage.service.js';
import { MessagingService } from '../messaging/messaging.service.js';
import { AuditService } from '../audit/audit.service.js';
import type { UploadMediaDto, MediaQueryDto } from './dto/index.js';
import type { MediaFile, MediaStatus, MediaType } from '../generated/prisma/client.js';

const MEDIA_BUCKET = 'media-raw';
const MEDIA_EXCHANGE = 'media.events';

@Injectable()
export class MediaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly messaging: MessagingService,
    private readonly audit: AuditService,
  ) {}

  async upload(
    dto: UploadMediaDto,
    file: Express.Multer.File,
    userId: string,
  ): Promise<MediaFile> {
    // Generate deterministic object key: yyyy/mm/uuid/originalname
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const id = randomUUID();
    const objectKey = `${year}/${month}/${id}/${file.originalname}`;

    // Compute checksum
    const checksum = createHash('sha256').update(file.buffer).digest('hex');

    // Upload to S3
    await this.storage.upload(
      MEDIA_BUCKET,
      objectKey,
      file.buffer,
      file.mimetype,
      { checksum, 'original-name': file.originalname },
    );

    // Create DB record
    const media = await this.prisma.mediaFile.create({
      data: {
        id,
        title: dto.title,
        description: dto.description,
        mediaType: dto.mediaType as MediaType,
        status: 'DRAFT',
        bucket: MEDIA_BUCKET,
        objectKey,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: BigInt(file.size),
        checksum,
        uploadedById: userId,
      },
    });

    // Publish event
    await this.messaging.publish(MEDIA_EXCHANGE, 'media.uploaded', {
      jobId: randomUUID(),
      idempotencyKey: `upload-${id}`,
      correlationId: id,
      attempt: 1,
      payloadVersion: 1,
      type: 'media.uploaded',
      payload: {
        mediaId: id,
        bucket: MEDIA_BUCKET,
        objectKey,
        mimeType: file.mimetype,
        size: file.size,
      },
      createdAt: now.toISOString(),
    });

    await this.audit.log({
      userId,
      action: 'create',
      resource: 'media',
      resourceId: id,
      details: { title: dto.title, mediaType: dto.mediaType, size: file.size },
    });

    return media;
  }

  async findAll(query: MediaQueryDto): Promise<{ data: MediaFile[]; total: number; nextCursor?: string }> {
    const limit = Math.min(Number(query.limit) || 20, 100);

    const where: Record<string, unknown> = {};
    if (query.status) where['status'] = query.status;
    if (query.mediaType) where['mediaType'] = query.mediaType;

    // Cursor-based pagination (preferred for performance)
    if (query.cursor) {
      const data = await this.prisma.mediaFile.findMany({
        where,
        take: limit + 1, // fetch one extra to determine if there's a next page
        cursor: { id: query.cursor },
        skip: 1, // skip the cursor item itself
        orderBy: { createdAt: 'desc' },
        include: { uploadedBy: { select: { id: true, firstName: true, lastName: true, email: true } } },
      });

      const hasNext = data.length > limit;
      const results = hasNext ? data.slice(0, limit) : data;
      const nextCursor = hasNext ? results[results.length - 1]?.id : undefined;

      const total = await this.prisma.mediaFile.count({ where });
      return { data: results, total, nextCursor };
    }

    // Offset-based pagination (fallback)
    const page = Number(query.page) || 1;
    const skip = (page - 1) * limit;

    const [data, total] = await this.prisma.$transaction([
      this.prisma.mediaFile.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { uploadedBy: { select: { id: true, firstName: true, lastName: true, email: true } } },
      }),
      this.prisma.mediaFile.count({ where }),
    ]);

    return { data, total };
  }

  async findOne(id: string): Promise<MediaFile> {
    const media = await this.prisma.mediaFile.findUnique({
      where: { id },
      include: { uploadedBy: { select: { id: true, firstName: true, lastName: true, email: true } } },
    });

    if (!media) {
      throw new NotFoundException('Media not found');
    }

    return media;
  }

  async updateStatus(id: string, status: MediaStatus, userId: string): Promise<MediaFile> {
    const media = await this.findOne(id);

    const updated = await this.prisma.mediaFile.update({
      where: { id },
      data: { status },
    });

    await this.audit.log({
      userId,
      action: 'update',
      resource: 'media',
      resourceId: id,
      details: { previousStatus: media.status, newStatus: status },
    });

    return updated;
  }
}
