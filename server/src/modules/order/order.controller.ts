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
  NotFoundException,
  ServiceUnavailableException,
  Res,
  StreamableFile,
} from '@nestjs/common';
import dayjs from 'dayjs';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { UserRole, OrderStatus } from '../../common/constants/enums';
import { DEFAULT_SHOP_ID } from '../../common/constants/shop';
import { resolveAdminTargetShopId, isPlatformAdmin } from '../../common/utils/admin-shop-scope';
import { success, ApiResponse } from '../../common/interfaces/api-response.interface';
import { PaginatedData } from '../../common/interfaces/pagination.interface';
import { OrderService, OrderRecord, OrderStats, DailyStatsItem, DeliveryTrackPointRecord, RiderLocationReportResult } from './order.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto, OrderQueryDto, CancelRequestDto, ResolveCancelRequestDto } from './dto/update-order.dto';
import { DeliveryTrackPointDto } from './dto/delivery-track.dto';
import { DeliverOrderDto } from './dto/deliver-order.dto';
import { ForceCompleteOrderDto } from './dto/force-complete-order.dto';
import { fetchStaticMapImage } from '../../common/utils/tencent-map';

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
    // 商家锁定绑定店；平台管理员可用 query.shop_id 切换。
    // 平台管理员不传 shop_id 时视为全店视角（跨店查询所有门店订单）。
    const requestedShopId = query.shop_id?.trim() || undefined;
    const isPlatformAllShops = isPlatformAdmin(user) && !requestedShopId;
    const adminShopId = isPlatformAllShops
      ? undefined
      : resolveAdminTargetShopId(user.shopId, requestedShopId, {
          lockToBoundShop: !!user.shopId,
        });

    let result: PaginatedData<OrderRecord>;

    if ((user.role === UserRole.ADMIN || user.role === UserRole.MERCHANT) && query.user_id) {
      result = await this.orderService.findByUserId(query.user_id, page, pageSize, query.status, query.keyword);
    } else if ((user.role === UserRole.ADMIN || user.role === UserRole.MERCHANT) && query.rider_id) {
      result = await this.orderService.findByRiderId(query.rider_id, query.status, page, pageSize, query.keyword);
    } else if (user.role === UserRole.ADMIN || user.role === UserRole.MERCHANT) {
      result = await this.orderService.findByShopId(
        adminShopId, query.status, page, pageSize, query.is_pool === 'true', query.keyword,
      );
    } else if (user.role === UserRole.RIDER && query.is_pool === 'true') {
      // 骑手跨店抢单：可不传 shop_id 查看全部店铺待抢单；传则按店过滤
      result = await this.orderService.findDeliveryPool(page, pageSize, query.shop_id, query.keyword);
    } else if (user.role === UserRole.RIDER) {
      result = await this.orderService.findByRiderId(user.userId, query.status, page, pageSize, query.keyword);
    } else if (user.role === UserRole.CUSTOMER) {
      // 顾客订单列表支持按 status 筛选（待支付/已支付等 Tab）
      result = await this.orderService.findByUserId(user.userId, page, pageSize, query.status, query.keyword);
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
    // PC 导出统一仅产出 Excel（.xlsx），不走 CSV（见需求 §3.21 / T267）。
    // 忽略调用方传入的 csv/both，强制 xlsx，保证「PC 导出不走 CSV」。
    const format: 'csv' | 'xlsx' | 'both' = 'xlsx';
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
    @Query('start_date') startDate: string | undefined,
    @Query('end_date') endDate: string | undefined,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<ApiResponse<DailyStatsItem[]>> {
    const shopId = this.resolveAdminShopId(user, queryShopId);
    // days=0 表示「全部」；否则限制在 1~90 天；start_date/end_date 优先
    const parsedDays = parseInt(days || '7', 10);
    const daysNum = parsedDays === 0 ? 0 : Math.min(Math.max(parsedDays || 7, 1), 90);
    const range =
      startDate && endDate
        ? { startDate, endDate }
        : undefined;
    const daily = await this.orderService.getDailyStats(shopId, daysNum, range);
    return success(daily);
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


  /**
   * 配送轨迹腾讯静态地图（图片）。
   * 用于 PC 管理后台订单详情直接展示真实腾讯地图，Key 仅留在服务端。
   */
  @Get(':id/delivery-map')
  async getDeliveryMap(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
    @Res({ passthrough: true }) res: any,
  ): Promise<StreamableFile> {
    const order = await this.orderService.findById(id);
    this.assertCanAccessOrder(order, user);

    const track = await this.orderService.listDeliveryTrack(id);
    const markers: Array<{
      latitude: number;
      longitude: number;
      color?: string;
      label?: string;
    }> = [];

    if (
      typeof order.shopLatitude === 'number' &&
      typeof order.shopLongitude === 'number' &&
      Number.isFinite(order.shopLatitude) &&
      Number.isFinite(order.shopLongitude)
    ) {
      markers.push({
        latitude: order.shopLatitude,
        longitude: order.shopLongitude,
        color: 'blue',
        label: 'S',
      });
    }

    const path = track.map((p) => ({ latitude: p.latitude, longitude: p.longitude }));
    if (track.length > 0) {
      const latest = track[track.length - 1];
      markers.push({
        latitude: latest.latitude,
        longitude: latest.longitude,
        color: '0xFF6B35',
        label: 'R',
      });
    }

    if (
      typeof order.deliveryLatitude === 'number' &&
      typeof order.deliveryLongitude === 'number' &&
      Number.isFinite(order.deliveryLatitude) &&
      Number.isFinite(order.deliveryLongitude)
    ) {
      markers.push({
        latitude: order.deliveryLatitude,
        longitude: order.deliveryLongitude,
        color: 'green',
        label: 'C',
      });
    }

    if (markers.length === 0) {
      throw new NotFoundException('暂无可用坐标');
    }

    const image = await fetchStaticMapImage({
      markers,
      path,
      size: '720*360',
      scale: 2,
    });

    if (!image) {
      throw new ServiceUnavailableException('腾讯地图暂不可用（请配置 TENCENT_MAP_KEY）');
    }

    res.set({
      'Content-Type': image.contentType,
      'Cache-Control': 'private, max-age=15',
    });
    return new StreamableFile(image.buffer);
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
  ): Promise<ApiResponse<OrderRecord>> {
    const order = await this.orderService.findById(id);
    this.assertCanAccessOrder(order, user);
    const result = await this.orderService.attachContactHints(order);

    // 若商家未填 ETA，进行中订单给一个温和兜底，避免覆盖已有 estimatedCompletion
    if (
      !result.estimatedCompletion &&
      [
        OrderStatus.ACCEPTED,
        OrderStatus.PREPARING,
        OrderStatus.READY_FOR_DELIVERY,
        OrderStatus.READY_FOR_PICKUP,
        OrderStatus.DELIVERING,
      ].includes(order.status)
    ) {
      const prepMinutes = 15;
      const deliveryMinutes = order.deliveryType === 'delivery' ? 20 : 0;
      result.estimatedCompletion = dayjs(order.updatedAt || order.createdAt)
        .add(prepMinutes + deliveryMinutes, 'minute')
        .toISOString();
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
    // 规则：顾客 pending_payment/paid 自主取消；商家可在接单后~待取餐/待配送关单退款
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
   * 顾客催单
   */
  @Post(':id/urge')
  @Roles(UserRole.CUSTOMER, UserRole.ADMIN)
  async urgeOrder(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<ApiResponse<OrderRecord>> {
    const order = await this.orderService.findById(id);
    this.assertCanAccessOrder(order, user);
    const updated = await this.orderService.urgeOrder(id, user.userId);
    return success(updated, '已催单，商家会尽快处理');
  }

  /**
   * 顾客申请取消（接单后）
   */
  @Post(':id/cancel-request')
  @Roles(UserRole.CUSTOMER, UserRole.ADMIN)
  async requestCancel(
    @Param('id') id: string,
    @Body() dto: CancelRequestDto,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<ApiResponse<OrderRecord>> {
    const order = await this.orderService.findById(id);
    this.assertCanAccessOrder(order, user);
    const updated = await this.orderService.requestCancel(id, user.userId, dto.reason);
    return success(updated, '已提交取消申请');
  }

  /**
   * 商家/管理员处理取消申请
   */
  @Post(':id/cancel-request/resolve')
  @Roles(UserRole.ADMIN, UserRole.MERCHANT)
  async resolveCancelRequest(
    @Param('id') id: string,
    @Body() dto: ResolveCancelRequestDto,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<ApiResponse<OrderRecord>> {
    const order = await this.orderService.findById(id);
    this.assertCanAccessOrder(order, user);
    const updated = await this.orderService.resolveCancelRequest(
      id,
      !!dto.approve,
      dto.reason,
    );
    return success(updated, dto.approve ? '已同意取消' : '已拒绝取消申请');
  }

  /**
   * 骑手释放订单回待抢池
   */
  @Post(':id/release')
  @Roles(UserRole.RIDER)
  async releaseOrder(
    @Param('id') id: string,
    @CurrentUser('userId') userId: string,
  ): Promise<ApiResponse<OrderRecord>> {
    const updated = await this.orderService.releaseOrder(id, userId);
    return success(updated, '已释放订单');
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
   * 商家/管理员强制完成外卖配送（跳过围栏与拍照，原因必填）
   */
  @Post(':id/force-complete')
  @Roles(UserRole.ADMIN, UserRole.MERCHANT)
  async forceCompleteOrder(
    @Param('id') id: string,
    @Body() dto: ForceCompleteOrderDto,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<ApiResponse<OrderRecord>> {
    const order = await this.orderService.findById(id);
    this.assertCanAccessOrder(order, user);
    const updated = await this.orderService.forceCompleteOrder(
      id,
      { userId: user.userId, role: String(user.role) },
      dto.reason,
    );
    return success(updated, '已强制完成');
  }

  /**
   * T246.3: 顾客自取/堂食自助确认取餐（仅 ready_for_pickup）
   */
  @Post(':id/customer-complete')
  @Roles(UserRole.CUSTOMER)
  async customerCompletePickup(
    @Param('id') id: string,
    @CurrentUser('userId') userId: string,
  ): Promise<ApiResponse<OrderRecord>> {
    const updated = await this.orderService.customerCompletePickup(id, userId);
    return success(updated, '已确认取餐');
  }

  /**
   * 骑手确认送达（地理围栏 + 现场照片）
   */
  @Post(':id/deliver')
  @Roles(UserRole.RIDER)
  async deliverOrder(
    @Param('id') id: string,
    @Body() dto: DeliverOrderDto,
    @CurrentUser('userId') userId: string,
  ): Promise<ApiResponse<OrderRecord>> {
    const order = await this.orderService.deliverOrder(id, userId, dto);
    return success(order, '已确认送达');
  }
}
