jest.mock('../src/database/prisma.service', () => {
  return jest.requireActual('../src/database/prisma.service');
});

import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, seedTestUser, loginUser, authHeader } from './helpers';
import { PrismaService } from '../src/database/prisma.service';

describe('ERP INA API (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let adminRefreshToken: string;

  const adminUser = {
    email: 'e2e-admin@test.local',
    password: 'TestPassword123!',
    firstName: 'E2E',
    lastName: 'Admin',
    roleName: 'admin',
  };

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    await seedTestUser(prisma, adminUser);
  });

  afterAll(async () => {
    // Cleanup test data
    const user = await prisma.user.findUnique({ where: { email: adminUser.email } });
    if (user) {
      await prisma.workflowAction.deleteMany({ where: { actorId: user.id } });
      await prisma.workflowInstance.deleteMany({ where: { createdById: user.id } });
      await prisma.documentVersion.deleteMany({ where: { uploadedById: user.id } });
      await prisma.document.deleteMany({ where: { createdById: user.id } });
      await prisma.mediaFile.deleteMany({ where: { uploadedById: user.id } });
      await prisma.auditLog.deleteMany({ where: { userId: user.id } });
      await prisma.refreshToken.deleteMany({ where: { userId: user.id } });
      await prisma.session.deleteMany({ where: { userId: user.id } });
      await prisma.userRole.deleteMany({ where: { userId: user.id } });
      await prisma.user.delete({ where: { id: user.id } });
    }
    await prisma.workflowDefinition.deleteMany({ where: { code: { startsWith: 'E2E_' } } });
    await app.close();
  });

  // ── Auth ──────────────────────────

  describe('Auth flow', () => {
    it('POST /auth/login — should authenticate', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: adminUser.email, password: adminUser.password })
        .expect(200);

      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.refreshToken).toBeDefined();
      expect(res.body.data.expiresIn).toBe(900);
      adminToken = res.body.data.accessToken;
      adminRefreshToken = res.body.data.refreshToken;
    });

    it('POST /auth/login — should reject invalid credentials', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: adminUser.email, password: 'WrongPassword!' })
        .expect(401);
    });

    it('POST /auth/login — should validate DTO', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'not-an-email', password: 'x' })
        .expect(400);

      // ValidationPipe returns message array
      expect(res.body.message).toBeInstanceOf(Array);
      expect(res.body.message).toEqual(
        expect.arrayContaining([
          expect.stringContaining('email'),
          expect.stringContaining('password'),
        ]),
      );
    });

    it('POST /auth/refresh — should rotate token', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: adminRefreshToken })
        .expect(200);

      expect(res.body.data.refreshToken).not.toBe(adminRefreshToken);
      adminToken = res.body.data.accessToken;
      adminRefreshToken = res.body.data.refreshToken;
    });

    it('POST /auth/refresh — should reject reused token', async () => {
      const tokens = await loginUser(app, adminUser.email, adminUser.password);
      await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: tokens.refreshToken })
        .expect(200);

      // Reuse
      await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: tokens.refreshToken })
        .expect(401);
    });

    it('POST /auth/logout — should revoke tokens', async () => {
      const tokens = await loginUser(app, adminUser.email, adminUser.password);

      await request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .set(authHeader(tokens.accessToken))
        .expect(204);

      await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: tokens.refreshToken })
        .expect(401);
    });

    it('POST /auth/logout — should require auth', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .expect(401);
    });
  });

  // ── Media ─────────────────────────

  describe('Media flow', () => {
    let mediaId: string;

    it('POST /media/upload — should upload a file', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/media/upload')
        .set(authHeader(adminToken))
        .field('title', 'E2E Test Video')
        .field('mediaType', 'VIDEO')
        .attach('file', Buffer.from('fake-video-content'), {
          filename: 'test.mp4',
          contentType: 'video/mp4',
        })
        .expect(201);

      expect(res.body.data.title).toBe('E2E Test Video');
      expect(res.body.data.status).toBe('DRAFT');
      expect(res.body.data.checksum).toBeDefined();
      mediaId = res.body.data.id;
    });

    it('POST /media/upload — should reject without auth', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/media/upload')
        .field('title', 'No Auth')
        .field('mediaType', 'VIDEO')
        .attach('file', Buffer.from('x'), { filename: 'x.mp4', contentType: 'video/mp4' })
        .expect(401);
    });

    it('GET /media — should list media', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/media')
        .set(authHeader(adminToken))
        .expect(200);

      expect(res.body.meta.total).toBeGreaterThanOrEqual(1);
    });

    it('GET /media/:id — should get media detail', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/media/${mediaId}`)
        .set(authHeader(adminToken))
        .expect(200);

      expect(res.body.data.id).toBe(mediaId);
    });

    it('GET /media/:id — should 404 unknown', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/media/00000000-0000-0000-0000-000000000000')
        .set(authHeader(adminToken))
        .expect(404);
    });

    it('PATCH /media/:id/status — should update status', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/media/${mediaId}/status`)
        .set(authHeader(adminToken))
        .send({ status: 'PUBLISHED' })
        .expect(200);

      expect(res.body.data.status).toBe('PUBLISHED');
    });
  });

  // ── Documents ─────────────────────

  describe('Documents flow', () => {
    let docId: string;

    it('POST /documents — should create with first version', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/documents')
        .set(authHeader(adminToken))
        .field('title', 'E2E Test Document')
        .field('classification', 'technique')
        .attach('file', Buffer.from('fake-pdf'), {
          filename: 'rapport.pdf',
          contentType: 'application/pdf',
        })
        .expect(201);

      expect(res.body.data.title).toBe('E2E Test Document');
      expect(res.body.data.currentVersion.versionNumber).toBe(1);
      docId = res.body.data.id;
    });

    it('POST /documents/:id/versions — should add version', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/documents/${docId}/versions`)
        .set(authHeader(adminToken))
        .field('comment', 'V2 e2e')
        .attach('file', Buffer.from('updated'), {
          filename: 'rapport-v2.pdf',
          contentType: 'application/pdf',
        })
        .expect(201);

      expect(res.body.data.versionNumber).toBe(2);
    });

    it('GET /documents — should list', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/documents')
        .set(authHeader(adminToken))
        .expect(200);

      expect(res.body.meta.total).toBeGreaterThanOrEqual(1);
    });

    it('GET /documents?search= — should search by title', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/documents?search=E2E')
        .set(authHeader(adminToken))
        .expect(200);

      expect(res.body.data.some((d: any) => d.title.includes('E2E'))).toBe(true);
    });

    it('GET /documents/:id/versions — should list versions', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/documents/${docId}/versions`)
        .set(authHeader(adminToken))
        .expect(200);

      expect(res.body.data.length).toBe(2);
    });

    it('PATCH /documents/:id/status — should update', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/documents/${docId}/status`)
        .set(authHeader(adminToken))
        .send({ status: 'ACTIVE' })
        .expect(200);

      expect(res.body.data.status).toBe('ACTIVE');
    });
  });

  // ── Workflow ──────────────────────

  describe('Workflow flow', () => {
    const defCode = `E2E_WF_${Date.now()}`;
    let instanceId: string;

    it('POST /workflow/definitions — should create', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/workflow/definitions')
        .set(authHeader(adminToken))
        .send({ code: defCode, name: 'E2E Workflow' })
        .expect(201);

      expect(res.body.data.code).toBe(defCode);
    });

    it('GET /workflow/definitions — should list', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/workflow/definitions')
        .set(authHeader(adminToken))
        .expect(200);

      expect(res.body.data.some((d: any) => d.code === defCode)).toBe(true);
    });

    it('POST /workflow/instances — should start', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/workflow/instances')
        .set(authHeader(adminToken))
        .send({ definitionCode: defCode, entityType: 'test', entityId: 'e2e-1' })
        .expect(201);

      expect(res.body.data.status).toBe('PENDING');
      instanceId = res.body.data.id;
    });

    it('POST /workflow/instances — should reject duplicate pending', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/workflow/instances')
        .set(authHeader(adminToken))
        .send({ definitionCode: defCode, entityType: 'test', entityId: 'e2e-1' })
        .expect(409);
    });

    it('GET /workflow/instances?status=PENDING — should filter', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/workflow/instances?status=PENDING')
        .set(authHeader(adminToken))
        .expect(200);

      expect(res.body.data.some((i: any) => i.id === instanceId)).toBe(true);
    });

    it('POST /workflow/instances/:id/actions — should approve', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/workflow/instances/${instanceId}/actions`)
        .set(authHeader(adminToken))
        .send({ action: 'approve', comment: 'E2E OK' })
        .expect(201);

      expect(res.body.data.action).toBe('approve');
    });

    it('POST /workflow/instances/:id/actions — should reject on non-PENDING', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/workflow/instances/${instanceId}/actions`)
        .set(authHeader(adminToken))
        .send({ action: 'reject' })
        .expect(400);
    });

    it('GET /workflow/instances/:id/actions — should list history', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/workflow/instances/${instanceId}/actions`)
        .set(authHeader(adminToken))
        .expect(200);

      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].action).toBe('approve');
    });
  });

  // ── Health ────────────────────────

  describe('Health', () => {
    it('GET /health — should return ok', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/health')
        .expect(200);

      expect(res.body.data.status).toBe('ok');
    });

    it('GET /health/ready — should check DB', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/health/ready')
        .expect(200);

      expect(res.body.data.status).toBe('ready');
      expect(res.body.data.checks.database).toBe('up');
    });
  });
});
