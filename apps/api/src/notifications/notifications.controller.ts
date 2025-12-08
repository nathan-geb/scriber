import {
    Controller,
    Get,
    Delete,
    Patch,
    Param,
    Query,
    UseGuards,
    Request,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
    constructor(private readonly notificationsService: NotificationsService) { }

    @Get()
    async getNotifications(
        @Request() req: { user: { userId: string } },
        @Query('limit') limit?: string,
        @Query('unreadOnly') unreadOnly?: string,
    ) {
        const notifications = await this.notificationsService.getUserNotifications(
            req.user.userId,
            limit ? parseInt(limit, 10) : 50,
            unreadOnly === 'true',
        );
        const unreadCount = await this.notificationsService.getUnreadCount(
            req.user.userId,
        );
        return { notifications, unreadCount };
    }

    @Get('unread-count')
    async getUnreadCount(@Request() req: { user: { userId: string } }) {
        const count = await this.notificationsService.getUnreadCount(
            req.user.userId,
        );
        return { count };
    }

    @Patch(':id/read')
    async markAsRead(
        @Request() req: { user: { userId: string } },
        @Param('id') id: string,
    ) {
        await this.notificationsService.markAsRead(req.user.userId, id);
        return { success: true };
    }

    @Patch('read-all')
    async markAllAsRead(@Request() req: { user: { userId: string } }) {
        await this.notificationsService.markAllAsRead(req.user.userId);
        return { success: true };
    }

    @Delete(':id')
    async deleteNotification(
        @Request() req: { user: { userId: string } },
        @Param('id') id: string,
    ) {
        await this.notificationsService.deleteNotification(req.user.userId, id);
        return { success: true };
    }
}
