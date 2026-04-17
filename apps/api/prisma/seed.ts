import 'dotenv/config';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import * as argon2 from 'argon2';

const pool = new pg.Pool({ connectionString: process.env['DATABASE_URL'] });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const DEV_PASSWORD = 'ChangeMe123!';

async function main() {
  console.log('Seeding database...');

  // ── Roles ──────────────────────────
  const roles = await Promise.all(
    [
      { name: 'admin', description: 'Administrateur systeme — acces complet' },
      { name: 'editor', description: 'Editeur — creation et modification de contenus' },
      { name: 'reviewer', description: 'Valideur — validation workflows' },
      { name: 'viewer', description: 'Lecteur — consultation seule' },
    ].map((r) =>
      prisma.role.upsert({
        where: { name: r.name },
        update: { description: r.description },
        create: r,
      }),
    ),
  );
  console.log(`  ${roles.length} roles crees/mis a jour`);

  // ── Permissions ────────────────────
  const resources = ['users', 'media', 'documents', 'workflow'];
  const actions = ['create', 'read', 'update', 'delete', 'validate'];
  const permissions = [];
  for (const resource of resources) {
    for (const action of actions) {
      const p = await prisma.permission.upsert({
        where: { resource_action: { resource, action } },
        update: {},
        create: { resource, action },
      });
      permissions.push(p);
    }
  }
  console.log(`  ${permissions.length} permissions crees/mis a jour`);

  // ── Role-Permissions mapping ───────
  const adminRole = roles.find((r) => r.name === 'admin')!;
  const editorRole = roles.find((r) => r.name === 'editor')!;
  const reviewerRole = roles.find((r) => r.name === 'reviewer')!;
  const viewerRole = roles.find((r) => r.name === 'viewer')!;

  // Admin: all permissions
  for (const p of permissions) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: adminRole.id, permissionId: p.id } },
      update: {},
      create: { roleId: adminRole.id, permissionId: p.id },
    });
  }

  // Editor: create, read, update on media/documents
  const editorPerms = permissions.filter(
    (p) =>
      ['media', 'documents'].includes(p.resource) &&
      ['create', 'read', 'update'].includes(p.action),
  );
  for (const p of editorPerms) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: editorRole.id, permissionId: p.id } },
      update: {},
      create: { roleId: editorRole.id, permissionId: p.id },
    });
  }

  // Reviewer: read on media/documents + validate on workflow
  const reviewerPerms = permissions.filter(
    (p) =>
      (['media', 'documents'].includes(p.resource) && p.action === 'read') ||
      (p.resource === 'workflow' && ['read', 'validate'].includes(p.action)),
  );
  for (const p of reviewerPerms) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: reviewerRole.id, permissionId: p.id } },
      update: {},
      create: { roleId: reviewerRole.id, permissionId: p.id },
    });
  }

  // Viewer: read only on everything
  const viewerPerms = permissions.filter((p) => p.action === 'read');
  for (const p of viewerPerms) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: viewerRole.id, permissionId: p.id } },
      update: {},
      create: { roleId: viewerRole.id, permissionId: p.id },
    });
  }
  console.log('  Role-permissions mappings configures');

  // ── Users ──────────────────────────
  const passwordHash = await argon2.hash(DEV_PASSWORD);

  const users = await Promise.all(
    [
      { email: 'admin@ina.local', firstName: 'Admin', lastName: 'INA', role: adminRole },
      { email: 'editor@ina.local', firstName: 'Editeur', lastName: 'INA', role: editorRole },
      { email: 'reviewer@ina.local', firstName: 'Valideur', lastName: 'INA', role: reviewerRole },
      { email: 'viewer@ina.local', firstName: 'Lecteur', lastName: 'INA', role: viewerRole },
    ].map(async (u) => {
      const user = await prisma.user.upsert({
        where: { email: u.email },
        update: { firstName: u.firstName, lastName: u.lastName },
        create: {
          email: u.email,
          password: passwordHash,
          firstName: u.firstName,
          lastName: u.lastName,
        },
      });
      await prisma.userRole.upsert({
        where: { userId_roleId: { userId: user.id, roleId: u.role.id } },
        update: {},
        create: { userId: user.id, roleId: u.role.id },
      });
      return user;
    }),
  );
  console.log(`  ${users.length} utilisateurs crees/mis a jour`);

  const adminUser = users[0]!;
  const editorUser = users[1]!;

  // ── Workflow Definitions ───────────
  const workflowDefs = await Promise.all(
    [
      { code: 'MEDIA_PUBLISH', name: 'Publication media', description: 'Validation avant publication de media' },
      { code: 'DOC_APPROVAL', name: 'Approbation document', description: 'Circuit de validation documentaire' },
      { code: 'FORM_APPROVAL', name: 'Approbation formulaire', description: 'Validation formulaire dematerialise' },
    ].map((d) =>
      prisma.workflowDefinition.upsert({
        where: { code: d.code },
        update: { name: d.name, description: d.description },
        create: d,
      }),
    ),
  );
  console.log(`  ${workflowDefs.length} workflow definitions crees/mis a jour`);

  // ── Sample Media ───────────────────
  const mediaTypes = ['VIDEO', 'AUDIO', 'IMAGE', 'DOCUMENT'] as const;
  const mediaItems = [];
  for (let i = 1; i <= 10; i++) {
    const mediaType = mediaTypes[(i - 1) % 4]!;
    const ext = { VIDEO: 'mp4', AUDIO: 'mp3', IMAGE: 'jpg', DOCUMENT: 'pdf' }[mediaType];
    const mime = { VIDEO: 'video/mp4', AUDIO: 'audio/mpeg', IMAGE: 'image/jpeg', DOCUMENT: 'application/pdf' }[mediaType];

    const media = await prisma.mediaFile.upsert({
      where: { id: `seed-media-${i}` },
      update: {},
      create: {
        id: `seed-media-${i}`,
        title: `Media de test ${i} (${mediaType.toLowerCase()})`,
        description: `Fichier ${mediaType.toLowerCase()} de demonstration #${i}`,
        mediaType,
        status: i <= 6 ? 'DRAFT' : i <= 8 ? 'PUBLISHED' : 'ARCHIVED',
        bucket: 'media-raw',
        objectKey: `2026/04/seed-media-${i}/sample.${ext}`,
        originalName: `sample-${i}.${ext}`,
        mimeType: mime,
        size: BigInt(1024 * 100 * i),
        checksum: `seed-checksum-${i}`,
        uploadedById: i % 2 === 0 ? editorUser.id : adminUser.id,
      },
    });
    mediaItems.push(media);
  }
  console.log(`  ${mediaItems.length} media crees/mis a jour`);

  // ── Sample Documents ───────────────
  const classifications = ['finance', 'rh', 'technique', 'juridique'];
  for (let i = 1; i <= 5; i++) {
    const docId = `seed-doc-${i}`;
    const versionId = `seed-doc-${i}-v1`;
    const classification = classifications[(i - 1) % 4]!;

    // Create document first (without currentVersion), then version, then link
    await prisma.document.upsert({
      where: { id: docId },
      update: {},
      create: {
        id: docId,
        title: `Document de test ${i}`,
        description: `Document ${classification} de demonstration`,
        classification,
        tags: [classification, 'test', 'seed'],
        status: i <= 3 ? 'DRAFT' : 'ACTIVE',
        isPublic: i === 1,
        createdById: adminUser.id,
      },
    });

    await prisma.documentVersion.upsert({
      where: { id: versionId },
      update: {},
      create: {
        id: versionId,
        documentId: docId,
        versionNumber: 1,
        comment: 'Version initiale (seed)',
        bucket: 'documents',
        objectKey: `2026/04/${docId}/v1/document-${i}.pdf`,
        originalName: `document-${i}.pdf`,
        mimeType: 'application/pdf',
        size: BigInt(2048 * i),
        checksum: `seed-doc-checksum-${i}`,
        uploadedById: adminUser.id,
      },
    });

    await prisma.document.update({
      where: { id: docId },
      data: { currentVersionId: versionId },
    });
  }
  console.log('  5 documents crees/mis a jour');

  // ── Sample Workflow Instances ──────
  const mediaPublishDef = workflowDefs.find((d) => d.code === 'MEDIA_PUBLISH')!;

  // 2 pending, 1 approved (with action)
  for (let i = 1; i <= 3; i++) {
    const instanceId = `seed-wf-${i}`;
    await prisma.workflowInstance.upsert({
      where: { id: instanceId },
      update: {},
      create: {
        id: instanceId,
        definitionId: mediaPublishDef.id,
        entityType: 'media',
        entityId: `seed-media-${i}`,
        status: i <= 2 ? 'PENDING' : 'APPROVED',
        currentStep: 'review',
        createdById: editorUser.id,
      },
    });

    if (i === 3) {
      await prisma.workflowAction.upsert({
        where: { id: `seed-wf-action-${i}` },
        update: {},
        create: {
          id: `seed-wf-action-${i}`,
          instanceId,
          actorId: adminUser.id,
          action: 'approve',
          comment: 'Approuve (seed data)',
        },
      });
    }
  }
  console.log('  3 workflow instances crees/mis a jour');

  console.log('\nSeed termine.');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
