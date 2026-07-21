import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  HttpCode,
  HttpStatus,
  ForbiddenException,
} from '@nestjs/common';
import dayjs from 'dayjs';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { UserRole, OrderStatus } from '../../common/constants/enums';
import { DEFAULT_SHOP_ID } from '../../common/constants/shop';
import { success, ApiResponse } from '../../common/interfaces/api-response.interface';
import { PaginatedData } from '../../common/interfaces/pagination.interface';
import { OrderService, OrderRecord, OrderStats, DailyStatsItem, StatusDistributionItem } from './order.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto, OrderQueryDto } from './dto/update-order.dto';

@Controller('orders')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  private assertCanAccessOrder(order: OrderRecord, user: CurrentUserPayload): void {
    // admin 只能访问自己绑定店铺的订单（多租户隔离）
    if (user.role === UserRole.ADMIN) {
      if (user.shopId && order.shopId !== user.shopId) {
        throw new ForbiddenException('无权访问其他店铺的订单');
      }
      return;
    }
    if (user.role === UserRole.CUSTOMER && order.userId === user.userId) return;
    if (user.role === UserRole.RIDER && order.riderId === user.userId) return;
    throw new ForbiddenException('无权访问该订单');
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createOrder(
    @Body() dto: CreateOrderDto,
    @CurrentUser('userId') userId: string,
  ): Promise<ApiResponse<OrderRecord>> {
    // 不修改入参 DTO，创建新对象传入 service
    const order = await this.orderService.create({ ...dto, userId });
    return success(order, '订单创建成功');
  }

  @Get()
  async getOrders(
    @Query() query: OrderQueryDto,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<ApiResponse<PaginatedData<OrderRecord>>> {
    const page = parseInt(query.page || '1', 10) || 1;
    const pageSize = parseInt(query.pageSize || '20', 10) || 20;
    // 多租户隔离：admin 只能查询自己绑定店铺的订单，不信任客户端传入的 shop_id
    const adminShopId = user.shopId || DEFAULT_SHOP_ID;

    let result: PaginatedData<OrderRecord>;

    if (user.role === UserRole.ADMIN && query.user_id) {
      result = await this.orderService.findByUserId(query.user_id, page, pageSize);
    } else if (user.role === UserRole.ADMIN && query.rider_id) {
      result = await this.orderService.findByRiderId(query.rider_id, query.status, page, pageSize);
    } else if (user.role === UserRole.ADMIN) {
      // admin 查询自己店铺的订单（忽略客户端 shop_id，强制使用 user.shopId）
      result = await this.orderService.findByShopId(
        adminShopId, query.status, page, pageSize, query.is_pool === 'true',
      );
    } else if (user.role === UserRole.RIDER && query.is_pool === 'true' && query.shop_id) {
      result = await this.orderService.findByShopId(
        query.shop_id, query.status, page, pageSize, true,
      );
    } else if (user.role === UserRole.RIDER) {
      result = await this.orderService.findByRiderId(user.userId, query.status, page, pageSize);
    } else if (user.role === UserRole.CUSTOMER) {
      result = await this.orderService.findByUserId(user.userId, page, pageSize);
    } else {
      result = { items: [], total: 0, page, pageSize };
    }

    return success(result);
  }

  @Get('stats/today')
  @Roles(UserRole.ADMIN)
  async getOrderStats(
    @CurrentUser('shopId') userShopId?: string,
  ): Promise<ApiResponse<OrderStats>> {
    // 多租户隔离：admin 只能查询自己绑定店铺的统计（shopId 从 JWT 取，不信任客户端）
    const shopId = userShopId || DEFAULT_SHOP_ID;
    const stats = await this.orderService.getTodayStats(shopId);
    return success(stats);
  }

  @Get('stats/daily')
  @Roles(UserRole.ADMIN)
  async getDailyStats(
    @Query('days') days: string | undefined,
    @CurrentUser('shopId') userShopId?: string,
  ): Promise<ApiResponse<DailyStatsItem[]>> {
    const shopId = userShopId || DEFAULT_SHOP_ID;
    const daysNum = Math.min(Math.max(parseInt(days || '7', 10) || 7, 1), 90);
    const daily = await this.orderService.getDailyStats(shopId, daysNum);
    return success(daily);
  }

  @Get('stats/status-distribution')
  @Roles(UserRole.ADMIN)
  async getStatusDistribution(
    @CurrentUser('shopId') userShopId?: string,
  ): Promise<ApiResponse<StatusDistributionItem[]>> {
    const shopId = userShopId || DEFAULT_SHOP_ID;
    const dist = await this.orderService.getStatusDistribution(shopId);
    return success(dist);
  }

  @Get(':id')
  async getOrder(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<ApiResponse<OrderRecord & { estimatedCompletion?: string }>> {
    const order = await this.orderService.findById(id);
    this.assertCanAccessOrder(order, user);
    const result: OrderRecord & { estimatedCompletion?: string } = { ...order };

    if ([OrderStatus.ACCEPTED, OrderStatus.PREPARING, OrderStatus.DELIVERING].includes(order.status)) {
      const prepMinutes = 5;
      const deliveryMinutes = order.deliveryType === 'delivery' ? 15 : 0;
      const estimated = dayjs().add(prepMinutes + deliveryMinutes, 'minute').toISOString();
      result.estimatedCompletion = estimated;
    }

    return success(result);
  }

  @Post(':id/status')
  @Roles(UserRole.ADMIN)
  async updateOrderStatus(
    @Param('id') id: string,
    @Body() dto: UpdateOrderDto,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<ApiResponse<OrderRecord>> {
    // 多租户隔离：admin 只能操作自己绑定店铺的订单
    const order = await this.orderService.findById(id);
    this.assertCanAccessOrder(order, user);
    const updated = await this.orderService.updateStatus(id, dto);
    return success(updated, '订单状态更新成功');
  }

  @Post(':id/cancel')
  @Roles(UserRole.ADMIN, UserRole.CUSTOMER)
  async cancelOrder(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<ApiResponse<OrderRecord>> {
    // 多租户隔离：校验访问权限（admin 仅本店铺，customer 仅本人订单）
    // 骑手无权取消订单（如需取消应通过 admin 处理）
    const order = await this.orderService.findById(id);
    this.assertCanAccessOrder(order, user);
    const cancelled = await this.orderService.cancelOrder(id, user.userId);
    return success(cancelled, '订单已取消');
  }

  @Post(':id/reorder')
  @HttpCode(HttpStatus.CREATED)
  async reorder(
    @Param('id') id: string,
    @CurrentUser('userId') userId: string,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<ApiResponse<OrderRecord>> {
    const order = await this.orderService.findById(id);
    this.assertCanAccessOrder(order, user);
    const reorderDto = {
      shopId: order.shopId,
      items: order.items.map((item) => ({
        menuItemId: item.menuItemId,
        name: item.name,
        quantity: item.quantity,
        specDesc: item.specDesc,
        imageUrl: item.imageUrl,
      })),
      deliveryType: order.deliveryType,
      address: order.address,
      tableNo: order.tableNo,
      remark: order.remark,
      // 从原订单复制联系方式，避免外送订单因无联系方式无法配送
      contactName: order.contactName,
      contactPhone: order.contactPhone,
    };
    const newOrder = await this.orderService.reorder(userId, reorderDto);
    return success(newOrder, '下单成功');
  }

  /**
   * 骑手抢单
   */
  @Post(':id/grab')
  @Roles(UserRole.RIDER)
  async grabOrder(
    @Param('id') id: string,
    @CurrentUser('userId') userId: string,
  ): Promise<ApiResponse<OrderRecord>> {
    const order = await this.orderService.grabOrder(id, userId);
    return success(order, '抢单成功');
  }

  /**
   * 骑手确认送达
   */
  @Post(':id/deliver')
  @Roles(UserRole.RIDER)
  async deliverOrder(
    @Param('id') id: string,
    @CurrentUser('userId') userId: string,
  ): Promise<ApiResponse<OrderRecord>> {
    const order = await this.orderService.deliverOrder(id, userId);
    return success(order, '已确认送达');
  }
}
