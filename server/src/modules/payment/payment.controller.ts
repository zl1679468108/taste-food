import { Controller, Post, Get, Param } from '@nestjs/common';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { success, ApiResponse } from '../../common/interfaces/api-response.interface';
import { PaymentService } from './payment.service';
import { PaymentResponseDto } from './dto/payment.dto';

/**
 * 支付控制器。
 * 路由前缀使用 `orders/:id/...`，与 OrderController 共享前缀但路径不冲突。
 */
@Controller('orders')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post(':id/pay')
  async payOrder(
    @Param('id') id: string,
    @CurrentUser('userId') userId: string,
  ): Promise<ApiResponse<PaymentResponseDto>> {
    const result = await this.paymentService.payOrder(id, userId);
    return success(result, '支付成功');
  }

  @Get(':id/payment')
  async getPayment(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<ApiResponse<PaymentResponseDto | null>> {
    const result = await this.paymentService.getPaymentByOrderId(id, user);
    return success(result);
  }
}
