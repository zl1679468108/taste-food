import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../common/constants/enums';
import { DEFAULT_SHOP_ID } from '../../common/constants/shop';
import { success, ApiResponse } from '../../common/interfaces/api-response.interface';
import { PaginatedData } from '../../common/interfaces/pagination.interface';
import { CreateReviewDto } from './dto/create-review.dto';
import { ReplyReviewDto } from './dto/reply-review.dto';
import { ReviewQueryDto } from './dto/review-query.dto';
import { ReviewRecord, ReviewService } from './review.service';
import { OrderService } from '../order/order.service';

/**
 * 订单评价接口（嵌套在 orders 资源下）
 * POST /api/orders/:id/reviews
 * GET  /api/orders/:id/reviews
 */
@Controller('orders')
export class OrderReviewController {
  constructor(
    private readonly reviewService: ReviewService,
    private readonly orderService: OrderService,
  ) {}

  private async assertCanViewOrderReview(orderId: string, user: CurrentUserPayload): Promise<void> {
    const order = await this.orderService.findById(orderId);
    if (user.role === UserRole.ADMIN) {
      if (user.shopId && order.shopId !== user.shopId) {
        throw new ForbiddenException('无权查看其他店铺订单评价');
      }
      return;
    }
    if (user.role === UserRole.CUSTOMER && order.userId === user.userId) return;
    throw new ForbiddenException('无权查看该订单评价');
  }

  @Post(':id/reviews')
  @HttpCode(HttpStatus.CREATED)
  async createReview(
    @Param('id') orderId: string,
    @Body() dto: CreateReviewDto,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<ApiResponse<ReviewRecord>> {
    const review = await this.reviewService.createForOrder(orderId, user.userId, dto);
    return success(review, '评价提交成功');
  }

  @Get(':id/reviews')
  async getReview(
    @Param('id') orderId: string,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<ApiResponse<ReviewRecord | null>> {
    await this.assertCanViewOrderReview(orderId, user);
    const review = await this.reviewService.findByOrderId(orderId);
    return success(review);
  }
}

/**
 * 评价列表
 * GET /api/reviews/mine?page=  — 顾客本人评价
 * GET /api/reviews?shopId=&page= — 商家店铺评价
 */
@Controller('reviews')
export class ReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  /**
   * 顾客「我的评价」
   * GET /api/reviews/mine?page=&pageSize=
   */
  @Get('mine')
  async listMyReviews(
    @Query() query: ReviewQueryDto,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<ApiResponse<PaginatedData<ReviewRecord>>> {
    const page = parseInt(query.page || '1', 10) || 1;
    const pageSize = parseInt(query.pageSize || '20', 10) || 20;
    const result = await this.reviewService.listByUser(user.userId, page, pageSize);
    return success(result);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.MERCHANT)
  async listReviews(
    @Query() query: ReviewQueryDto,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<ApiResponse<PaginatedData<ReviewRecord>>> {
    // 多租户：强制使用 JWT shopId，忽略客户端伪造
    const shopId = user.shopId || query.shopId || DEFAULT_SHOP_ID;
    const page = parseInt(query.page || '1', 10) || 1;
    const pageSize = parseInt(query.pageSize || '20', 10) || 20;
    const result = await this.reviewService.listByShop(shopId, page, pageSize);
    return success(result);
  }
  @Patch(':id/reply')
  @Roles(UserRole.ADMIN, UserRole.MERCHANT)
  async replyReview(
    @Param('id') id: string,
    @Body() dto: ReplyReviewDto,
    @CurrentUser('shopId') userShopId?: string,
  ): Promise<ApiResponse<ReviewRecord>> {
    const shopId = userShopId || DEFAULT_SHOP_ID;
    const review = await this.reviewService.replyToReview(id, shopId, dto.reply);
    return success(review, '回复成功');
  }

}
