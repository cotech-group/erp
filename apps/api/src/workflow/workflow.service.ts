import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import type {
  CreateDefinitionDto,
  StartWorkflowDto,
  SubmitActionDto,
  WorkflowQueryDto,
} from './dto/index.js';
import type {
  WorkflowDefinition,
  WorkflowInstance,
  WorkflowAction,
  WorkflowStatus,
} from '../generated/prisma/client.js';

const ACTION_TO_STATUS: Record<string, WorkflowStatus> = {
  approve: 'APPROVED',
  reject: 'REJECTED',
  cancel: 'CANCELLED',
};

@Injectable()
export class WorkflowService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  // ── Definitions ──────────────────────

  async createDefinition(dto: CreateDefinitionDto): Promise<WorkflowDefinition> {
    return this.prisma.workflowDefinition.create({
      data: {
        code: dto.code,
        name: dto.name,
        description: dto.description,
      },
    });
  }

  async listDefinitions(): Promise<WorkflowDefinition[]> {
    return this.prisma.workflowDefinition.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  // ── Instances ────────────────────────

  async startWorkflow(dto: StartWorkflowDto, userId: string): Promise<WorkflowInstance> {
    const definition = await this.prisma.workflowDefinition.findUnique({
      where: { code: dto.definitionCode },
    });

    if (!definition) {
      throw new NotFoundException(`Workflow definition '${dto.definitionCode}' not found`);
    }

    if (!definition.isActive) {
      throw new BadRequestException(`Workflow definition '${dto.definitionCode}' is inactive`);
    }

    // Check no pending workflow already exists for this entity
    const existing = await this.prisma.workflowInstance.findFirst({
      where: {
        definitionId: definition.id,
        entityType: dto.entityType,
        entityId: dto.entityId,
        status: 'PENDING',
      },
    });

    if (existing) {
      throw new ConflictException(
        `A pending workflow already exists for ${dto.entityType}/${dto.entityId}`,
      );
    }

    const instance = await this.prisma.workflowInstance.create({
      data: {
        definitionId: definition.id,
        entityType: dto.entityType,
        entityId: dto.entityId,
        status: 'PENDING',
        currentStep: 'review',
        createdById: userId,
      },
      include: { definition: true },
    });

    await this.audit.log({
      userId,
      action: 'create',
      resource: 'workflow',
      resourceId: instance.id,
      details: {
        definitionCode: dto.definitionCode,
        entityType: dto.entityType,
        entityId: dto.entityId,
      },
    });

    return instance;
  }

  async findAllInstances(
    query: WorkflowQueryDto,
  ): Promise<{ data: WorkflowInstance[]; total: number }> {
    const page = Number(query.page) || 1;
    const limit = Math.min(Number(query.limit) || 20, 100);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (query.status) where['status'] = query.status;
    if (query.entityType) where['entityType'] = query.entityType;
    if (query.definitionCode) {
      where['definition'] = { code: query.definitionCode };
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.workflowInstance.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          definition: { select: { id: true, code: true, name: true } },
          createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      }),
      this.prisma.workflowInstance.count({ where }),
    ]);

    return { data, total };
  }

  async findOneInstance(id: string): Promise<WorkflowInstance> {
    const instance = await this.prisma.workflowInstance.findUnique({
      where: { id },
      include: {
        definition: true,
        createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        actions: {
          orderBy: { createdAt: 'asc' },
          include: {
            actor: { select: { id: true, firstName: true, lastName: true, email: true } },
          },
        },
      },
    });

    if (!instance) {
      throw new NotFoundException('Workflow instance not found');
    }

    return instance;
  }

  // ── Actions ──────────────────────────

  async submitAction(
    instanceId: string,
    dto: SubmitActionDto,
    userId: string,
  ): Promise<WorkflowAction> {
    const instance = await this.findOneInstance(instanceId);

    if (instance.status !== 'PENDING') {
      throw new BadRequestException(
        `Cannot perform action on workflow with status '${instance.status}'`,
      );
    }

    const newStatus = ACTION_TO_STATUS[dto.action];

    const action = await this.prisma.$transaction(async (tx) => {
      const wfAction = await tx.workflowAction.create({
        data: {
          instanceId,
          actorId: userId,
          action: dto.action,
          comment: dto.comment,
        },
        include: {
          actor: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      });

      if (newStatus) {
        await tx.workflowInstance.update({
          where: { id: instanceId },
          data: { status: newStatus },
        });
      }

      return wfAction;
    });

    await this.audit.log({
      userId,
      action: 'validate',
      resource: 'workflow',
      resourceId: instanceId,
      details: {
        action: dto.action,
        comment: dto.comment,
        previousStatus: instance.status,
        newStatus: newStatus ?? instance.status,
      },
    });

    // Notify the workflow creator
    if (instance.createdById !== userId) {
      const actor = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { firstName: true, lastName: true },
      });
      const actorName = actor ? `${actor.firstName} ${actor.lastName}` : 'Un utilisateur';

      await this.notifications.notifyWorkflowAction({
        recipientUserId: instance.createdById,
        actorName,
        action: dto.action,
        workflowName: (instance as any).definition?.name ?? 'Workflow',
        entityType: instance.entityType,
        entityId: instance.entityId,
        instanceId,
      });
    }

    return action;
  }

  async getActions(instanceId: string): Promise<WorkflowAction[]> {
    await this.findOneInstance(instanceId); // ensure exists

    return this.prisma.workflowAction.findMany({
      where: { instanceId },
      orderBy: { createdAt: 'asc' },
      include: {
        actor: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });
  }
}
