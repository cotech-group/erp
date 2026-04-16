import { Injectable, OnModuleInit } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  CreateBucketCommand,
  HeadBucketCommand,
} from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { Readable } from 'stream';

export interface UploadResult {
  bucket: string;
  key: string;
  size: number;
}

@Injectable()
export class StorageService implements OnModuleInit {
  private client: S3Client;

  private readonly buckets = ['media-raw', 'media-processed', 'documents', 'archives'] as const;

  constructor() {
    this.client = new S3Client({
      endpoint: process.env['S3_ENDPOINT'] || 'http://localhost:9000',
      region: 'us-east-1',
      credentials: {
        accessKeyId: process.env['S3_ACCESS_KEY'] || 'minioadmin',
        secretAccessKey: process.env['S3_SECRET_KEY'] || 'minioadmin',
      },
      forcePathStyle: true, // required for MinIO
    });
  }

  async onModuleInit() {
    for (const bucket of this.buckets) {
      await this.ensureBucket(bucket);
    }
  }

  private async ensureBucket(bucket: string): Promise<void> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: bucket }));
    } catch {
      try {
        await this.client.send(new CreateBucketCommand({ Bucket: bucket }));
      } catch {
        // Bucket may have been created concurrently
      }
    }
  }

  async upload(
    bucket: string,
    key: string,
    body: Buffer | Readable,
    contentType: string,
    metadata?: Record<string, string>,
  ): Promise<UploadResult> {
    const upload = new Upload({
      client: this.client,
      params: {
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        Metadata: metadata,
      },
    });

    const result = await upload.done();
    const head = await this.client.send(
      new HeadObjectCommand({ Bucket: bucket, Key: key }),
    );

    return {
      bucket,
      key,
      size: head.ContentLength ?? 0,
    };
  }

  async getObject(bucket: string, key: string): Promise<Readable> {
    const response = await this.client.send(
      new GetObjectCommand({ Bucket: bucket, Key: key }),
    );
    return response.Body as Readable;
  }

  async deleteObject(bucket: string, key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: bucket, Key: key }),
    );
  }
}
