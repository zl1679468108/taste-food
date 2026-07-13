import { Controller, Post, Get, Param, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../common/guards/auth.guard';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { success, ApiResponse } from '../../common/interfaces/api-response.interface';
import { PaymentService } from './payment.service';
import { PaymentResponseDto } from './dto/payment.dto';

@Controller('orders')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post(':id/pay')
  @UseGuards(AuthGuard)
  async payOrder(
    @Param('id') id: string,
    @CurrentUser('userId') userId: string,
  ): Promise<ApiResponse<PaymentResponseDto>> {
    const result = await this.paymentService.payOrder(id, userId);
    return success(result, '支付成功');
  }

  @Get(':id/payment')
  @UseGuards(AuthGuard)
  async getPayment(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<ApiResponse<PaymentResponseDto | null>> {
    const result = await this.paymentService.getPaymentByOrderId(id, user);
    return success(result);
  }
}
