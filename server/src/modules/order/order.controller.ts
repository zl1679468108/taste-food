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
import { resolveAdminTargetShopId } from '../../common/utils/admin-shop-scope';
import { success, ApiResponse } from '../../common/interfaces/api-response.interface';
import { PaginatedData } from '../../common/interfaces/pagination.interface';
import { OrderService, OrderRecord, OrderStats, DailyStatsItem, StatusDistributionItem, DeliveryTrackPointRecord, RiderLocationReportResult } from './order.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto, OrderQueryDto } from './dto/update-order.dto';
import { DeliveryTrackPointDto } from './dto/delivery-track.dto';

@Controller('orders')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  private assertCanAccessOrder(order: OrderRecord, user: CurrentUserPayload): void {
    // admin 只能访问自己绑定店铺的订单（多租户隔离）
    if (user.role === UserRole.ADMIN || user.role === UserRole.MERCHANT) {
      // 商家必须本店；平台管理员可跨店
      if (user.role === UserRole.MERCHANT && user.shopId && order.shopId !== user.shopId) {
        throw new ForbiddenException('无权访问其他店铺的订单');
      }
      if (user.role === UserRole.ADMIN && user.shopId && order.shopId !== user.shopId) {
        throw new ForbiddenException('无权访问其他店铺的订单');
      }
      return;
    }
    if (user.role === UserRole.CUSTOMER && order.userId === user.userId) return;
    // 旧库可能无 rider_id：骑手可访问配送中/已完成的外送单（演示兼容）
    if (user.role === UserRole.RIDER) {
      if (order.riderId === user.userId) return;
      if (
        !order.riderId &&
        order.deliveryType === 'delivery' &&
        (order.status === 'delivering' || order.status === 'completed')
      ) {
        return;
      }
    }
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
    // 商家锁定绑定店；平台管理员可用 query.shop_id 切换
    const adminShopId = resolveAdminTargetShopId(user.shopId, query.shop_id, {
      lockToBoundShop: !!user.shopId,
    });

    let result: PaginatedData<OrderRecord>;

    if ((user.role === UserRole.ADMIN || user.role === UserRole.MERCHANT) && query.user_id) {
      result = await this.orderService.findByUserId(query.user_id, page, pageSize, query.status);
    } else if ((user.role === UserRole.ADMIN || user.role === UserRole.MERCHANT) && query.rider_id) {
      result = await this.orderService.findByRiderId(query.rider_id, query.status, page, pageSize);
    } else if (user.role === UserRole.ADMIN || user.role === UserRole.MERCHANT) {
      result = await this.orderService.findByShopId(
        adminShopId, query.status, page, pageSize, query.is_pool === 'true',
      );
    } else if (user.role === UserRole.RIDER && query.is_pool === 'true') {
      // 骑手跨店抢单：可不传 shop_id 查看全部店铺待抢单；传则按店过滤
      result = await this.orderService.findDeliveryPool(page, pageSize, query.shop_id);
    } else if (user.role === UserRole.RIDER) {
      result = await this.orderService.findByRiderId(user.userId, query.status, page, pageSize);
    } else if (user.role === UserRole.CUSTOMER) {
      // 顾客订单列表支持按 status 筛选（待支付/已支付等 Tab）
      result = await this.orderService.findByUserId(user.userId, page, pageSize, query.status);
    } else {
      result = { items: [], total: 0, page, pageSize };
    }

    return success(result);
  }

  @Get('export')
  @Roles(UserRole.ADMIN, UserRole.MERCHANT)
  async exportOrders(
    @Query('status') status: string | undefined,
    @Query('maxRows') maxRowsRaw: string | undefined,
    @Query('format') formatRaw: string | undefined,
    @Query('shop_id') queryShopId: string | undefined,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<
    ApiResponse<{
      csv: string;
      xlsxBase64?: string;
      count: number;
      filename: string;
      xlsxFilename?: string;
      contentType?: string;
    }>
  > {
    const shopId = resolveAdminTargetShopId(user.shopId, queryShopId, {
      lockToBoundShop: !!user.shopId,
    });
    const maxRows = maxRowsRaw ? parseInt(maxRowsRaw, 10) : 1000;
    const raw = String(formatRaw || 'both').toLowerCase();
    const format: 'csv' | 'xlsx' | 'both' =
      raw === 'csv' || raw === 'xlsx' || raw === 'both' ? raw : 'both';
    const data = await this.orderService.exportOrdersCsv(shopId, {
      status: status || undefined,
      maxRows: Number.isFinite(maxRows) ? maxRows : 1000,
      format,
    });
    return success(data, '导出成功');
  }

  private resolveAdminShopId(user: CurrentUserPayload, queryShopId?: string): string {
    return resolveAdminTargetShopId(user.shopId, queryShopId, {
      lockToBoundShop: !!user.shopId,
    });
  }

  @Get('stats/today')
  @Roles(UserRole.ADMIN, UserRole.MERCHANT)
  async getOrderStats(
    @Query('shop_id') queryShopId: string | undefined,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<ApiResponse<OrderStats>> {
    const shopId = this.resolveAdminShopId(user, queryShopId);
    const stats = await this.orderService.getTodayStats(shopId);
    return success(stats);
  }

  @Get('stats/daily')
  @Roles(UserRole.ADMIN, UserRole.MERCHANT)
  async getDailyStats(
    @Query('days') days: string | undefined,
    @Query('shop_id') queryShopId: string | undefined,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<ApiResponse<DailyStatsItem[]>> {
    const shopId = this.resolveAdminShopId(user, queryShopId);
    // days=0 表示「全部」；否则限制在 1~90 天
    const parsedDays = parseInt(days || '7', 10);
    const daysNum = parsedDays === 0 ? 0 : Math.min(Math.max(parsedDays || 7, 1), 90);
    const daily = await this.orderService.getDailyStats(shopId, daysNum);
    return success(daily);
  }

  @Get('stats/status-distribution')
  @Roles(UserRole.ADMIN, UserRole.MERCHANT)
  async getStatusDistribution(
    @Query('shop_id') queryShopId: string | undefined,
    @Query('days') days: string | undefined,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<ApiResponse<StatusDistributionItem[]>> {
    const shopId = this.resolveAdminShopId(user, queryShopId);
    const daysNum = days ? Math.min(Math.max(parseInt(days, 10) || 0, 0), 90) : undefined;
    const dist = await this.orderService.getStatusDistribution(shopId, daysNum || undefined);
    return success(dist);
  }

  /**
   * 骑手无感定位上报：一次请求同步到该骑手全部配送中订单。
   * 必须声明在 `:id` 系列路由之前，避免 rider 被当作订单 ID 匹配。
   */
  @Post('rider/location')
  @Roles(UserRole.RIDER)
  @HttpCode(HttpStatus.OK)
  async reportRiderLocation(
    @Body() dto: DeliveryTrackPointDto,
    @CurrentUser('userId') userId: string,
  ): Promise<ApiResponse<RiderLocationReportResult>> {
    const result = await this.orderService.reportRiderLocation(userId, dto);
    return success(result, result.reported > 0 ? '位置已同步' : '当前无配送中订单');
  }

  @Get(':id/delivery-track')
  async getDeliveryTrack(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<ApiResponse<DeliveryTrackPointRecord[]>> {
    const order = await this.orderService.findById(id);
    this.assertCanAccessOrder(order, user);
    const track = await this.orderService.listDeliveryTrack(id);
    return success(track);
  }

  @Post(':id/delivery-track')
  @Roles(UserRole.ADMIN, UserRole.MERCHANT, UserRole.RIDER)
  async appendDeliveryTrack(
    @Param('id') id: string,
    @Body() dto: DeliveryTrackPointDto,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<ApiResponse<DeliveryTrackPointRecord>> {
    const order = await this.orderService.findById(id);
    this.assertCanAccessOrder(order, user);
    const reporterId = user.role === UserRole.ADMIN ? (order.riderId || user.userId) : user.userId;
    const point = await this.orderService.appendDeliveryTrackPoint(id, reporterId, dto);
    return success(point, '配送位置已更新');
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
  @Roles(UserRole.ADMIN, UserRole.MERCHANT)
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
  @Roles(UserRole.ADMIN, UserRole.MERCHANT, UserRole.CUSTOMER)
  async cancelOrder(
    @Param('id') id: string,
    @Body() dto: UpdateOrderDto,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<ApiResponse<OrderRecord>> {
    // 多租户隔离：校验访问权限（admin 仅本店铺，customer 仅本人订单）
    // 骑手无权取消订单（如需取消应通过 admin 处理）
    // 规则：顾客可在 pending_payment/paid 自主取消；商家接单后需商家/管理员处理
    const order = await this.orderService.findById(id);
    this.assertCanAccessOrder(order, user);
    // 仅顾客需要把 userId 传入做「本人订单」校验；商家/管理员取消本店单不校验下单人
    const actorUserId = user.role === UserRole.CUSTOMER ? user.userId : undefined;
    const cancelled = await this.orderService.cancelOrder(id, actorUserId, dto.reason);
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
      deliveryLatitude: order.deliveryLatitude,
      deliveryLongitude: order.deliveryLongitude,
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
