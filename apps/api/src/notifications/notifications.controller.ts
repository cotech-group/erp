import { Controller, Get, Patch, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { JwtPayload } from '../auth/auth.service.js';

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async findAll(
    @CurrentUser() user: JwtPayload,
    @Query('unread') unread?: string,
  ) {
    const unreadOnly = unread === 'true';
    const [notifications, unreadCount] = await Promise.all([
      this.notificationsService.findByUser(user.sub, unreadOnly),
      this.notificationsService.countUnread(user.sub),
    ]);

    return {
      data: notifications,
      meta: { unreadCount, timestamp: new Date().toISOString() },
    };
  }

  @Patch(':id/read')
  async markAsRead(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    await this.notificationsService.markAsRead(id, user.sub);
    return {
      data: { success: true },
      meta: { timestamp: new Date().toISOString() },
    };
  }

  @Patch('read-all')
  async markAllAsRead(@CurrentUser() user: JwtPayload) {
    await this.notificationsService.markAllAsRead(user.sub);
    return {
      data: { success: true },
      meta: { timestamp: new Date().toISOString() },
    };
  }
}
