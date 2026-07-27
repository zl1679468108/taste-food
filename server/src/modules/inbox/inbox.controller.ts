import { Controller, Get, Patch, Param, Query } from '@nestjs/common';
import { InboxService } from './inbox.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { success, ApiResponse } from '../../common/interfaces/api-response.interface';

@Controller('notifications')
export class InboxController {
  constructor(private readonly inboxService: InboxService) {}

  @Get()
  async list(
    @CurrentUser('userId') userId: string,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
  ): Promise<ApiResponse<any>> {
    const result = await this.inboxService.listForUser(
      userId,
      parseInt(page, 10) || 1,
      parseInt(pageSize, 10) || 20,
    );
    return success(result);
  }

  @Get('unread-count')
  async unread(@CurrentUser('userId') userId: string): Promise<ApiResponse<{ count: number }>> {
    const count = await this.inboxService.unreadCount(userId);
    return success({ count });
  }

  @Patch(':id/read')
  async markRead(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
  ): Promise<ApiResponse<any>> {
    const row = await this.inboxService.markRead(userId, id);
    return success(row, '已标记已读');
  }

  @Patch('read-all')
  async markAll(@CurrentUser('userId') userId: string): Promise<ApiResponse<{ count: number }>> {
    const count = await this.inboxService.markAllRead(userId);
    return success({ count }, '全部已读');
  }
}
