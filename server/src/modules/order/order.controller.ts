import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  UseGuards,
  Patch,
} from '@nestjs/common';
import dayjs from 'dayjs';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole, OrderStatus } from '../../common/constants/enums';
import { success, ApiResponse } from '../../common/interfaces/api-response.interface';
import { PaginatedData } from '../../common/interfaces/pagination.interface';
import { OrderService, OrderRecord, OrderStats } from './order.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto, OrderQueryDto } from './dto/update-order.dto';

@Controller('orders')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Post()
  @UseGuards(AuthGuard)
  async createOrder(
    @Body() dto: CreateOrderDto,
    @CurrentUser('userId') userId: string,
  ): Promise<ApiResponse<OrderRecord>> {
    dto.userId = userId;
    const order = await this.orderService.create(dto);
    return success(order, '订单创建成功');
  }

  @Get()
  @UseGuards(AuthGuard)
  async getOrders(
    @Query() query: OrderQueryDto,
  ): Promise<ApiResponse<PaginatedData<OrderRecord>>> {
    const page = parseInt(query.page || '1', 10);
    const pageSize = parseInt(query.pageSize || '20', 10);

    let result: PaginatedData<OrderRecord>;

    if (query.shop_id) {
      result = await this.orderService.findByShopId(
        query.shop_id, query.status, page, pageSize, query.is_pool === 'true',
      );
    } else if (query.user_id) {
      result = await this.orderService.findByUserId(query.user_id, page, pageSize);
    } else if (query.rider_id) {
      result = await this.orderService.findByRiderId(query.rider_id, query.status, page, pageSize);
    } else {
      result = { items: [], total: 0, page, pageSize };
    }

    return success(result);
  }

  @Get('stats/:shopId')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async getOrderStats(
    @Param('shopId') shopId: string,
  ): Promise<ApiResponse<OrderStats>> {
    const stats = await this.orderService.getTodayStats(shopId);
    return success(stats);
  }

  @Get(':id')
  @UseGuards(AuthGuard)
  async getOrder(
    @Param('id') id: string,
  ): Promise<ApiResponse<OrderRecord & { estimatedCompletion?: string }>> {
    const order = await this.orderService.findById(id);
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
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async updateOrderStatus(
    @Param('id') id: string,
    @Body() dto: UpdateOrderDto,
  ): Promise<ApiResponse<OrderRecord>> {
    const order = await this.orderService.updateStatus(id, dto);
    return success(order, '订单状态更新成功');
  }

  @Post(':id/cancel')
  @UseGuards(AuthGuard)
  async cancelOrder(
    @Param('id') id: string,
    @CurrentUser('userId') userId: string,
  ): Promise<ApiResponse<OrderRecord>> {
    const order = await this.orderService.cancelOrder(id, userId);
    return success(order, '订单已取消');
  }

  @Post(':id/reorder')
  @UseGuards(AuthGuard)
  async reorder(
    @Param('id') id: string,
    @CurrentUser('userId') userId: string,
  ): Promise<ApiResponse<OrderRecord>> {
    const order = await this.orderService.findById(id);
    const reorderDto = {
      shopId: order.shopId,
      items: order.items.map((item) => ({
        menuItemId: item.menuItemId,
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        specDesc: item.specDesc,
        imageUrl: item.imageUrl,
      })),
      deliveryType: order.deliveryType,
      address: order.address,
      tableNo: order.tableNo,
      remark: order.remark,
    };
    const newOrder = await this.orderService.reorder(userId, reorderDto);
    return success(newOrder, '下单成功');
  }

  /**
   * 骑手抢单
   */
  @Post(':id/grab')
  @UseGuards(AuthGuard, RolesGuard)
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
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserRole.RIDER)
  async deliverOrder(
    @Param('id') id: string,
    @CurrentUser('userId') userId: string,
  ): Promise<ApiResponse<OrderRecord>> {
    const order = await this.orderService.deliverOrder(id, userId);
    return success(order, '已确认送达');
  }
}
