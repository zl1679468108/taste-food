import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../common/constants/enums';
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
        query.shop_id,
        query.status,
        page,
        pageSize,
      );
    } else if (query.user_id) {
      result = await this.orderService.findByUserId(
        query.user_id,
        page,
        pageSize,
      );
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
  ): Promise<ApiResponse<OrderRecord>> {
    const order = await this.orderService.findById(id);
    return success(order);
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
}
