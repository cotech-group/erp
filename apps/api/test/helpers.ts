import 'dotenv/config';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import * as argon2 from 'argon2';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { StorageService } from '../src/storage/storage.service';

// Mock StorageService to avoid real S3/MinIO dependency in e2e tests
const mockStorageService = {
  onModuleInit: async () => {},
  upload: async (_bucket: string, key: string, _body: any, _contentType: string) => ({
    bucket: _bucket,
    key,
    size: _body?.length ?? 100,
  }),
  getObject: async () => {
    const { Readable } = await import('stream');
    return Readable.from(Buffer.from('mock-file-content'));
  },
  deleteObject: async () => {},
  ensureBucket: async () => {},
};

export async function createTestApp(): Promise<INestApplication> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(StorageService)
    .useValue(mockStorageService)
    .compile();

  const app = moduleFixture.createNestApplication();

  app.setGlobalPrefix('api/v1', { exclude: ['metrics'] });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await app.init();
  return app;
}

export async function seedTestUser(
  prisma: PrismaService,
  data: { email: string; password: string; firstName: string; lastName: string; roleName: string },
) {
  const passwordHash = await argon2.hash(data.password);

  const role = await prisma.role.upsert({
    where: { name: data.roleName },
    update: {},
    create: { name: data.roleName },
  });

  const user = await prisma.user.upsert({
    where: { email: data.email },
    update: { password: passwordHash },
    create: {
      email: data.email,
      password: passwordHash,
      firstName: data.firstName,
      lastName: data.lastName,
    },
  });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: user.id, roleId: role.id } },
    update: {},
    create: { userId: user.id, roleId: role.id },
  });

  return user;
}

export async function loginUser(
  app: INestApplication,
  email: string,
  password: string,
): Promise<{ accessToken: string; refreshToken: string }> {
  const res = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .send({ email, password })
    .expect(200);

  return res.body.data;
}

export function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}
