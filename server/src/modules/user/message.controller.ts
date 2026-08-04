import { Controller, Get, Post, Patch, Param, Query, Body } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../common/constants/enums';
import { success, ApiResponse } from '../../common/interfaces/api-response.interface';
import { MessageService, PaginatedShopMessages, ShopMessage } from './message.service';

/**
 * 商家 → 顾客 站内信接口（§3.25 / T314）
 * 仅商家可访问；数据范围严格绑定当前商家 shop_id。
 */
@Controller('merchant/messages')
export class MessageController {
  constructor(private readonly messageService: MessageService) {}

  @Post('customers/:id')
  @Roles(UserRole.MERCHANT)
  async send(
    @Param('id') toUserId: string,
    @Body() body: { content?: string },
    @CurrentUser() user?: CurrentUserPayload,
  ): Promise<ApiResponse<ShopMessage>> {
    const result = await this.messageService.sendMessage(
      user?.shopId,
      user?.userId,
      toUserId,
      body.content || '',
    );
    return success(result);
  }

  @Get()
  @Roles(UserRole.MERCHANT)
  async list(
    @Query('toUserId') toUserId?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @CurrentUser() user?: CurrentUserPayload,
  ): Promise<ApiResponse<PaginatedShopMessages>> {
    const result = await this.messageService.listMessages(user?.shopId, {
      toUserId,
      page: page ? parseInt(page, 10) : 1,
      pageSize: pageSize ? parseInt(pageSize, 10) : 20,
    });
    return success(result);
  }

  @Patch(':id/read')
  @Roles(UserRole.MERCHANT)
  async markRead(
    @Param('id') id: string,
    @CurrentUser() user?: CurrentUserPayload,
  ): Promise<ApiResponse<null>> {
    await this.messageService.markRead(user?.shopId, id);
    return success(null);
  }
}
