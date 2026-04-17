import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';

export interface CreateNotificationDto {
  userId: string;
  type: string;
  title: string;
  message: string;
  link?: string;
}

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateNotificationDto) {
    return this.prisma.notification.create({
      data: {
        userId: dto.userId,
        type: dto.type,
        title: dto.title,
        message: dto.message,
        link: dto.link,
      },
    });
  }

  async findByUser(userId: string, unreadOnly = false) {
    return this.prisma.notification.findMany({
      where: {
        userId,
        ...(unreadOnly ? { read: false } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async countUnread(userId: string): Promise<number> {
    return this.prisma.notification.count({
      where: { userId, read: false },
    });
  }

  async markAsRead(id: string, userId: string) {
    return this.prisma.notification.updateMany({
      where: { id, userId },
      data: { read: true },
    });
  }

  async markAllAsRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });
  }

  // Called by workflow service on approve/reject
  async notifyWorkflowAction(params: {
    recipientUserId: string;
    actorName: string;
    action: string;
    workflowName: string;
    entityType: string;
    entityId: string;
    instanceId: string;
  }) {
    const actionLabels: Record<string, string> = {
      approve: 'approuve',
      reject: 'rejete',
      cancel: 'annule',
      request_changes: 'demande des modifications sur',
    };

    const actionLabel = actionLabels[params.action] ?? params.action;

    await this.create({
      userId: params.recipientUserId,
      type: `workflow.${params.action}`,
      title: `Workflow ${actionLabel}`,
      message: `${params.actorName} a ${actionLabel} le workflow "${params.workflowName}" pour ${params.entityType}/${params.entityId}`,
      link: `/workflow`,
    });
  }
}
