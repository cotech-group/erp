jest.mock('../database/prisma.service', () => ({
  PrismaService: jest.fn(),
}));

import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { WorkflowService } from './workflow.service';
import { PrismaService } from '../database/prisma.service';
import { AuditService } from '../audit/audit.service';

describe('WorkflowService', () => {
  let service: WorkflowService;
  let prisma: Record<string, any>;
  let audit: Record<string, any>;

  const mockDefinition = {
    id: 'def-1',
    code: 'MEDIA_PUBLISH',
    name: 'Publication media',
    description: 'Workflow de publication media',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockInstance = {
    id: 'inst-1',
    definitionId: 'def-1',
    definition: mockDefinition,
    entityType: 'media',
    entityId: 'media-1',
    status: 'PENDING',
    currentStep: 'review',
    createdById: 'user-1',
    createdBy: { id: 'user-1', firstName: 'Test', lastName: 'User', email: 'test@ina.fr' },
    createdAt: new Date(),
    updatedAt: new Date(),
    actions: [],
  };

  const mockAction = {
    id: 'action-1',
    instanceId: 'inst-1',
    actorId: 'user-2',
    actor: { id: 'user-2', firstName: 'Reviewer', lastName: 'User', email: 'reviewer@ina.fr' },
    action: 'approve',
    comment: 'Looks good',
    createdAt: new Date(),
  };

  beforeEach(async () => {
    prisma = {
      workflowDefinition: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
      workflowInstance: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      workflowAction: {
        create: jest.fn(),
        findMany: jest.fn(),
      },
      $transaction: jest.fn((fn: any) => {
        if (typeof fn === 'function') {
          return fn(prisma);
        }
        return Promise.all(fn);
      }),
    };

    audit = {
      log: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkflowService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();

    service = module.get<WorkflowService>(WorkflowService);
  });

  describe('createDefinition', () => {
    it('should create a workflow definition', async () => {
      prisma.workflowDefinition.create.mockResolvedValue(mockDefinition);

      const result = await service.createDefinition({
        code: 'MEDIA_PUBLISH',
        name: 'Publication media',
      });

      expect(result.code).toBe('MEDIA_PUBLISH');
      expect(prisma.workflowDefinition.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ code: 'MEDIA_PUBLISH' }),
        }),
      );
    });
  });

  describe('listDefinitions', () => {
    it('should return active definitions', async () => {
      prisma.workflowDefinition.findMany.mockResolvedValue([mockDefinition]);

      const result = await service.listDefinitions();

      expect(result).toHaveLength(1);
      expect(prisma.workflowDefinition.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { isActive: true } }),
      );
    });
  });

  describe('startWorkflow', () => {
    it('should start a workflow instance', async () => {
      prisma.workflowDefinition.findUnique.mockResolvedValue(mockDefinition);
      prisma.workflowInstance.findFirst.mockResolvedValue(null);
      prisma.workflowInstance.create.mockResolvedValue(mockInstance);

      const result = await service.startWorkflow(
        { definitionCode: 'MEDIA_PUBLISH', entityType: 'media', entityId: 'media-1' },
        'user-1',
      );

      expect(result.status).toBe('PENDING');
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'create', resource: 'workflow' }),
      );
    });

    it('should throw NotFoundException for unknown definition', async () => {
      prisma.workflowDefinition.findUnique.mockResolvedValue(null);

      await expect(
        service.startWorkflow(
          { definitionCode: 'UNKNOWN', entityType: 'media', entityId: 'media-1' },
          'user-1',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for inactive definition', async () => {
      prisma.workflowDefinition.findUnique.mockResolvedValue({
        ...mockDefinition,
        isActive: false,
      });

      await expect(
        service.startWorkflow(
          { definitionCode: 'MEDIA_PUBLISH', entityType: 'media', entityId: 'media-1' },
          'user-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ConflictException if pending workflow already exists', async () => {
      prisma.workflowDefinition.findUnique.mockResolvedValue(mockDefinition);
      prisma.workflowInstance.findFirst.mockResolvedValue(mockInstance);

      await expect(
        service.startWorkflow(
          { definitionCode: 'MEDIA_PUBLISH', entityType: 'media', entityId: 'media-1' },
          'user-1',
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('findAllInstances', () => {
    it('should return paginated instances', async () => {
      prisma.workflowInstance.findMany.mockResolvedValue([mockInstance]);
      prisma.workflowInstance.count.mockResolvedValue(1);

      const result = await service.findAllInstances({ page: 1, limit: 20 });

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should filter by status', async () => {
      prisma.workflowInstance.findMany.mockResolvedValue([]);
      prisma.workflowInstance.count.mockResolvedValue(0);

      await service.findAllInstances({ status: 'PENDING' });

      expect(prisma.workflowInstance.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'PENDING' }),
        }),
      );
    });
  });

  describe('findOneInstance', () => {
    it('should return instance by id', async () => {
      prisma.workflowInstance.findUnique.mockResolvedValue(mockInstance);
      const result = await service.findOneInstance('inst-1');
      expect(result.id).toBe('inst-1');
    });

    it('should throw NotFoundException', async () => {
      prisma.workflowInstance.findUnique.mockResolvedValue(null);
      await expect(service.findOneInstance('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('submitAction', () => {
    it('should approve and update instance status', async () => {
      prisma.workflowInstance.findUnique.mockResolvedValue(mockInstance);
      prisma.workflowAction.create.mockResolvedValue(mockAction);
      prisma.workflowInstance.update.mockResolvedValue({ ...mockInstance, status: 'APPROVED' });

      const result = await service.submitAction(
        'inst-1',
        { action: 'approve', comment: 'Looks good' },
        'user-2',
      );

      expect(result.action).toBe('approve');
      expect(prisma.workflowInstance.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: 'APPROVED' },
        }),
      );
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'validate',
          details: expect.objectContaining({ action: 'approve', newStatus: 'APPROVED' }),
        }),
      );
    });

    it('should reject and update instance status', async () => {
      prisma.workflowInstance.findUnique.mockResolvedValue(mockInstance);
      prisma.workflowAction.create.mockResolvedValue({ ...mockAction, action: 'reject' });
      prisma.workflowInstance.update.mockResolvedValue({ ...mockInstance, status: 'REJECTED' });

      const result = await service.submitAction(
        'inst-1',
        { action: 'reject', comment: 'Needs rework' },
        'user-2',
      );

      expect(result.action).toBe('reject');
      expect(prisma.workflowInstance.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 'REJECTED' } }),
      );
    });

    it('should handle request_changes without changing status', async () => {
      prisma.workflowInstance.findUnique.mockResolvedValue(mockInstance);
      prisma.workflowAction.create.mockResolvedValue({
        ...mockAction,
        action: 'request_changes',
      });

      await service.submitAction(
        'inst-1',
        { action: 'request_changes', comment: 'Fix title' },
        'user-2',
      );

      expect(prisma.workflowInstance.update).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException on non-PENDING instance', async () => {
      prisma.workflowInstance.findUnique.mockResolvedValue({
        ...mockInstance,
        status: 'APPROVED',
      });

      await expect(
        service.submitAction('inst-1', { action: 'approve' }, 'user-2'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getActions', () => {
    it('should return actions for an instance', async () => {
      prisma.workflowInstance.findUnique.mockResolvedValue(mockInstance);
      prisma.workflowAction.findMany.mockResolvedValue([mockAction]);

      const result = await service.getActions('inst-1');

      expect(result).toHaveLength(1);
      expect(prisma.workflowAction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { instanceId: 'inst-1' } }),
      );
    });
  });
});
