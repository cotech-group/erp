import { Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import { Readable } from 'stream';
import { PrismaService } from '../database/prisma.service.js';
import { StorageService } from '../storage/storage.service.js';
import { AuditService } from '../audit/audit.service.js';
import type { CreateDocumentDto, UploadVersionDto, DocumentQueryDto } from './dto/index.js';
import type { Document, DocumentVersion } from '../generated/prisma/client.js';

const DOCUMENTS_BUCKET = 'documents';

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
  ) {}

  async create(
    dto: CreateDocumentDto,
    file: Express.Multer.File,
    userId: string,
  ): Promise<Document & { currentVersion: DocumentVersion | null }> {
    const docId = randomUUID();
    const versionId = randomUUID();
    const objectKey = this.buildObjectKey(docId, 1, file.originalname);
    const checksum = createHash('sha256').update(file.buffer).digest('hex');

    // Upload to S3
    await this.storage.upload(DOCUMENTS_BUCKET, objectKey, file.buffer, file.mimetype, {
      checksum,
      'original-name': file.originalname,
    });

    // Create document + first version in transaction
    const document = await this.prisma.$transaction(async (tx) => {
      const version = await tx.documentVersion.create({
        data: {
          id: versionId,
          documentId: docId,
          versionNumber: 1,
          comment: 'Version initiale',
          bucket: DOCUMENTS_BUCKET,
          objectKey,
          originalName: file.originalname,
          mimeType: file.mimetype,
          size: BigInt(file.size),
          checksum,
          uploadedById: userId,
        },
      });

      const doc = await tx.document.create({
        data: {
          id: docId,
          title: dto.title,
          description: dto.description,
          classification: dto.classification,
          tags: dto.tags ?? [],
          isPublic: dto.isPublic ?? false,
          currentVersionId: versionId,
          createdById: userId,
        },
        include: { currentVersion: true },
      });

      return doc;
    });

    await this.audit.log({
      userId,
      action: 'create',
      resource: 'documents',
      resourceId: docId,
      details: { title: dto.title, classification: dto.classification },
    });

    return document;
  }

  async uploadVersion(
    documentId: string,
    dto: UploadVersionDto,
    file: Express.Multer.File,
    userId: string,
  ): Promise<DocumentVersion> {
    const doc = await this.findOne(documentId);

    // Determine next version number
    const lastVersion = await this.prisma.documentVersion.findFirst({
      where: { documentId },
      orderBy: { versionNumber: 'desc' },
    });
    const nextVersion = (lastVersion?.versionNumber ?? 0) + 1;

    const versionId = randomUUID();
    const objectKey = this.buildObjectKey(documentId, nextVersion, file.originalname);
    const checksum = createHash('sha256').update(file.buffer).digest('hex');

    await this.storage.upload(DOCUMENTS_BUCKET, objectKey, file.buffer, file.mimetype, {
      checksum,
      'original-name': file.originalname,
    });

    const version = await this.prisma.$transaction(async (tx) => {
      const v = await tx.documentVersion.create({
        data: {
          id: versionId,
          documentId,
          versionNumber: nextVersion,
          comment: dto.comment,
          bucket: DOCUMENTS_BUCKET,
          objectKey,
          originalName: file.originalname,
          mimeType: file.mimetype,
          size: BigInt(file.size),
          checksum,
          uploadedById: userId,
        },
      });

      await tx.document.update({
        where: { id: documentId },
        data: { currentVersionId: versionId },
      });

      return v;
    });

    await this.audit.log({
      userId,
      action: 'update',
      resource: 'documents',
      resourceId: documentId,
      details: { versionNumber: nextVersion, comment: dto.comment },
    });

    return version;
  }

  async findAll(query: DocumentQueryDto): Promise<{ data: Document[]; total: number }> {
    const page = Number(query.page) || 1;
    const limit = Math.min(Number(query.limit) || 20, 100);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (query.status) where['status'] = query.status;
    if (query.classification) where['classification'] = query.classification;
    if (query.search) {
      where['title'] = { contains: query.search, mode: 'insensitive' };
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.document.findMany({
        where,
        skip,
        take: limit,
        orderBy: { updatedAt: 'desc' },
        include: {
          currentVersion: { select: { id: true, versionNumber: true, originalName: true, mimeType: true, size: true, createdAt: true } },
          createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      }),
      this.prisma.document.count({ where }),
    ]);

    return { data, total };
  }

  async findOne(id: string): Promise<Document> {
    const doc = await this.prisma.document.findUnique({
      where: { id },
      include: {
        currentVersion: true,
        createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    if (!doc) {
      throw new NotFoundException('Document not found');
    }

    return doc;
  }

  async getVersions(documentId: string): Promise<DocumentVersion[]> {
    await this.findOne(documentId); // ensure exists

    return this.prisma.documentVersion.findMany({
      where: { documentId },
      orderBy: { versionNumber: 'desc' },
      include: {
        uploadedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });
  }

  async downloadVersion(documentId: string, versionNumber: number): Promise<{ stream: Readable; version: DocumentVersion }> {
    const version = await this.prisma.documentVersion.findUnique({
      where: { documentId_versionNumber: { documentId, versionNumber } },
    });

    if (!version) {
      throw new NotFoundException(`Version ${versionNumber} not found`);
    }

    const stream = await this.storage.getObject(version.bucket, version.objectKey);
    return { stream, version };
  }

  async updateStatus(id: string, status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED', userId: string): Promise<Document> {
    const doc = await this.findOne(id);

    const updated = await this.prisma.document.update({
      where: { id },
      data: { status },
      include: { currentVersion: true },
    });

    await this.audit.log({
      userId,
      action: 'update',
      resource: 'documents',
      resourceId: id,
      details: { previousStatus: doc.status, newStatus: status },
    });

    return updated;
  }

  private buildObjectKey(docId: string, version: number, filename: string): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}/${month}/${docId}/v${version}/${filename}`;
  }
}
