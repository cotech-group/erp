jest.mock('../database/prisma.service', () => ({
  PrismaService: jest.fn(),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { PrismaService } from '../database/prisma.service';
import { StorageService } from '../storage/storage.service';
import { AuditService } from '../audit/audit.service';

describe('DocumentsService', () => {
  let service: DocumentsService;
  let prisma: Record<string, any>;
  let storage: Record<string, any>;
  let audit: Record<string, any>;

  const mockVersion = {
    id: 'version-1',
    documentId: 'doc-1',
    versionNumber: 1,
    comment: 'Version initiale',
    bucket: 'documents',
    objectKey: '2026/04/doc-1/v1/rapport.pdf',
    originalName: 'rapport.pdf',
    mimeType: 'application/pdf',
    size: BigInt(2048),
    checksum: 'abc123',
    uploadedById: 'user-1',
    createdAt: new Date(),
  };

  const mockDocument = {
    id: 'doc-1',
    title: 'Rapport annuel',
    description: 'Rapport annuel 2026',
    classification: 'finance',
    tags: ['rapport', 'annuel'],
    status: 'DRAFT',
    currentVersionId: 'version-1',
    currentVersion: mockVersion,
    isPublic: false,
    createdById: 'user-1',
    createdBy: { id: 'user-1', firstName: 'Test', lastName: 'User', email: 'test@ina.fr' },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockFile = {
    originalname: 'rapport.pdf',
    mimetype: 'application/pdf',
    size: 2048,
    buffer: Buffer.from('fake-pdf-content'),
  } as Express.Multer.File;

  beforeEach(async () => {
    prisma = {
      document: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      documentVersion: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      $transaction: jest.fn((fn: any) => {
        if (typeof fn === 'function') {
          return fn(prisma);
        }
        return Promise.all(fn);
      }),
    };

    storage = {
      upload: jest.fn().mockResolvedValue({ bucket: 'documents', key: 'test-key', size: 2048 }),
      getObject: jest.fn(),
    };

    audit = {
      log: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: StorageService, useValue: storage },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();

    service = module.get<DocumentsService>(DocumentsService);
  });

  describe('create', () => {
    it('should upload file, create document with first version, and audit', async () => {
      prisma.document.create.mockResolvedValue(mockDocument);
      prisma.documentVersion.create.mockResolvedValue(mockVersion);
      prisma.document.update.mockResolvedValue(mockDocument);

      const result = await service.create(
        { title: 'Rapport annuel', description: 'Rapport annuel 2026', classification: 'finance', tags: ['rapport', 'annuel'] },
        mockFile,
        'user-1',
      );

      expect(storage.upload).toHaveBeenCalledWith(
        'documents',
        expect.stringContaining('rapport.pdf'),
        mockFile.buffer,
        'application/pdf',
        expect.objectContaining({ checksum: expect.any(String) }),
      );
      expect(prisma.document.create).toHaveBeenCalled();
      expect(prisma.documentVersion.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ versionNumber: 1, comment: 'Version initiale' }),
        }),
      );
      expect(prisma.document.update).toHaveBeenCalled();
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'create', resource: 'documents' }),
      );
      expect(result).toEqual(mockDocument);
    });
  });

  describe('uploadVersion', () => {
    it('should create a new version and update currentVersion pointer', async () => {
      prisma.document.findUnique.mockResolvedValue(mockDocument);
      prisma.documentVersion.findFirst.mockResolvedValue(mockVersion);
      const newVersion = { ...mockVersion, id: 'version-2', versionNumber: 2, comment: 'Mise a jour' };
      prisma.documentVersion.create.mockResolvedValue(newVersion);
      prisma.document.update.mockResolvedValue({ ...mockDocument, currentVersionId: 'version-2' });

      const result = await service.uploadVersion('doc-1', { comment: 'Mise a jour' }, mockFile, 'user-1');

      expect(result.versionNumber).toBe(2);
      expect(prisma.document.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'doc-1' },
          data: { currentVersionId: expect.any(String) },
        }),
      );
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ details: expect.objectContaining({ versionNumber: 2 }) }),
      );
    });
  });

  describe('findAll', () => {
    it('should return paginated results', async () => {
      prisma.document.findMany.mockResolvedValue([mockDocument]);
      prisma.document.count.mockResolvedValue(1);

      const result = await service.findAll({ page: 1, limit: 20 });

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should filter by status and classification', async () => {
      prisma.document.findMany.mockResolvedValue([]);
      prisma.document.count.mockResolvedValue(0);

      await service.findAll({ status: 'ACTIVE', classification: 'finance' });

      expect(prisma.document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'ACTIVE', classification: 'finance' },
        }),
      );
    });

    it('should support search by title', async () => {
      prisma.document.findMany.mockResolvedValue([]);
      prisma.document.count.mockResolvedValue(0);

      await service.findAll({ search: 'rapport' });

      expect(prisma.document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { title: { contains: 'rapport', mode: 'insensitive' } },
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return document by id', async () => {
      prisma.document.findUnique.mockResolvedValue(mockDocument);
      const result = await service.findOne('doc-1');
      expect(result).toEqual(mockDocument);
    });

    it('should throw NotFoundException when not found', async () => {
      prisma.document.findUnique.mockResolvedValue(null);
      await expect(service.findOne('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getVersions', () => {
    it('should return all versions ordered by versionNumber desc', async () => {
      prisma.document.findUnique.mockResolvedValue(mockDocument);
      prisma.documentVersion.findMany.mockResolvedValue([mockVersion]);

      const result = await service.getVersions('doc-1');

      expect(result).toHaveLength(1);
      expect(prisma.documentVersion.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { documentId: 'doc-1' },
          orderBy: { versionNumber: 'desc' },
        }),
      );
    });
  });

  describe('downloadVersion', () => {
    it('should return stream and version info', async () => {
      const mockStream = { pipe: jest.fn() };
      prisma.documentVersion.findUnique.mockResolvedValue(mockVersion);
      storage.getObject.mockResolvedValue(mockStream);

      const result = await service.downloadVersion('doc-1', 1);

      expect(result.version).toEqual(mockVersion);
      expect(result.stream).toEqual(mockStream);
      expect(storage.getObject).toHaveBeenCalledWith('documents', mockVersion.objectKey);
    });

    it('should throw NotFoundException for unknown version', async () => {
      prisma.documentVersion.findUnique.mockResolvedValue(null);
      await expect(service.downloadVersion('doc-1', 99)).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateStatus', () => {
    it('should update status and audit', async () => {
      prisma.document.findUnique.mockResolvedValue(mockDocument);
      prisma.document.update.mockResolvedValue({ ...mockDocument, status: 'ACTIVE' });

      const result = await service.updateStatus('doc-1', 'ACTIVE', 'user-1');

      expect(result.status).toBe('ACTIVE');
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'update',
          details: { previousStatus: 'DRAFT', newStatus: 'ACTIVE' },
        }),
      );
    });
  });
});
