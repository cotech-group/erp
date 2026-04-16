jest.mock('../database/prisma.service', () => ({
  PrismaService: jest.fn(),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { MediaService } from './media.service';
import { PrismaService } from '../database/prisma.service';
import { StorageService } from '../storage/storage.service';
import { MessagingService } from '../messaging/messaging.service';
import { AuditService } from '../audit/audit.service';

describe('MediaService', () => {
  let service: MediaService;
  let prisma: Record<string, any>;
  let storage: Record<string, any>;
  let messaging: Record<string, any>;
  let audit: Record<string, any>;

  const mockMedia = {
    id: 'media-1',
    title: 'Test Video',
    description: 'A test video',
    mediaType: 'VIDEO',
    status: 'DRAFT',
    bucket: 'media-raw',
    objectKey: '2026/04/media-1/test.mp4',
    originalName: 'test.mp4',
    mimeType: 'video/mp4',
    size: BigInt(1024000),
    checksum: 'abc123',
    uploadedById: 'user-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    metadata: null,
    uploadedBy: { id: 'user-1', firstName: 'Test', lastName: 'User', email: 'test@ina.fr' },
  };

  beforeEach(async () => {
    prisma = {
      mediaFile: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    };

    storage = {
      upload: jest.fn().mockResolvedValue({ bucket: 'media-raw', key: 'test-key', size: 1024000 }),
    };

    messaging = {
      publish: jest.fn().mockResolvedValue(undefined),
    };

    audit = {
      log: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MediaService,
        { provide: PrismaService, useValue: prisma },
        { provide: StorageService, useValue: storage },
        { provide: MessagingService, useValue: messaging },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();

    service = module.get<MediaService>(MediaService);
  });

  describe('upload', () => {
    const mockFile = {
      originalname: 'test.mp4',
      mimetype: 'video/mp4',
      size: 1024000,
      buffer: Buffer.from('fake-video-content'),
    } as Express.Multer.File;

    it('should upload file to S3, create DB record, and publish event', async () => {
      prisma.mediaFile.create.mockResolvedValue(mockMedia);

      const result = await service.upload(
        { title: 'Test Video', mediaType: 'VIDEO' },
        mockFile,
        'user-1',
      );

      expect(storage.upload).toHaveBeenCalledWith(
        'media-raw',
        expect.stringContaining('test.mp4'),
        mockFile.buffer,
        'video/mp4',
        expect.objectContaining({ checksum: expect.any(String) }),
      );
      expect(prisma.mediaFile.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            title: 'Test Video',
            mediaType: 'VIDEO',
            status: 'DRAFT',
            uploadedById: 'user-1',
          }),
        }),
      );
      expect(messaging.publish).toHaveBeenCalledWith(
        'media.events',
        'media.uploaded',
        expect.objectContaining({ type: 'media.uploaded' }),
      );
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'create', resource: 'media' }),
      );
      expect(result).toEqual(mockMedia);
    });
  });

  describe('findAll', () => {
    it('should return paginated results', async () => {
      prisma.mediaFile.findMany.mockResolvedValue([mockMedia]);
      prisma.mediaFile.count.mockResolvedValue(1);

      const result = await service.findAll({ page: 1, limit: 20 });

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should filter by status and mediaType', async () => {
      prisma.mediaFile.findMany.mockResolvedValue([]);
      prisma.mediaFile.count.mockResolvedValue(0);

      await service.findAll({ status: 'PUBLISHED', mediaType: 'VIDEO' });

      expect(prisma.mediaFile.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'PUBLISHED', mediaType: 'VIDEO' },
        }),
      );
    });

    it('should cap limit at 100', async () => {
      prisma.mediaFile.findMany.mockResolvedValue([]);
      prisma.mediaFile.count.mockResolvedValue(0);

      await service.findAll({ limit: 500 });

      expect(prisma.mediaFile.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 100 }),
      );
    });
  });

  describe('findOne', () => {
    it('should return media by id', async () => {
      prisma.mediaFile.findUnique.mockResolvedValue(mockMedia);

      const result = await service.findOne('media-1');
      expect(result).toEqual(mockMedia);
    });

    it('should throw NotFoundException when not found', async () => {
      prisma.mediaFile.findUnique.mockResolvedValue(null);

      await expect(service.findOne('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateStatus', () => {
    it('should update status and audit', async () => {
      prisma.mediaFile.findUnique.mockResolvedValue(mockMedia);
      prisma.mediaFile.update.mockResolvedValue({ ...mockMedia, status: 'PUBLISHED' });

      const result = await service.updateStatus('media-1', 'PUBLISHED' as any, 'user-1');

      expect(result.status).toBe('PUBLISHED');
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'update',
          details: { previousStatus: 'DRAFT', newStatus: 'PUBLISHED' },
        }),
      );
    });
  });
});
