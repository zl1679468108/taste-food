import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { PromotionService } from './promotion.service';
import { CreatePromotionDto, UpdatePromotionDto, PromotionResponseDto } from './dto/promotion.dto';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { success, ApiResponse } from '../../common/interfaces/api-response.interface';

@Controller('promotions')
export class PromotionController {
  constructor(private readonly promotionService: PromotionService) {}

  /**
   * GET /api/promotions?shopId=xxx
   * 获取指定店铺可用的促销活动（公开接口）
   */
  @Get()
  async findAll(@Query('shopId') shopId: string): Promise<ApiResponse<PromotionResponseDto[]>> {
    if (!shopId) {
      throw new BadRequestException('缺少 shopId 参数');
    }
    const promotions = await this.promotionService.findAllByShop(shopId);
    return success(promotions);
  }

  /**
   * POST /api/promotions
   * 创建促销活动（需 Admin 认证）
   */
  @Post()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('admin')
  async create(@Body() dto: CreatePromotionDto): Promise<ApiResponse<PromotionResponseDto>> {
    const promotion = await this.promotionService.create(dto);
    return success(promotion, '促销创建成功');
  }

  /**
   * PATCH /api/promotions/:id
   * 更新促销活动（需 Admin 认证）
   */
  @Patch(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('admin')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdatePromotionDto,
  ): Promise<ApiResponse<PromotionResponseDto>> {
    const promotion = await this.promotionService.update(id, dto);
    return success(promotion, '促销更新成功');
  }

  /**
   * DELETE /api/promotions/:id
   * 删除促销活动（需 Admin 认证）
   */
  @Delete(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('admin')
  async remove(@Param('id') id: string): Promise<ApiResponse<null>> {
    await this.promotionService.remove(id);
    return success(null, '促销删除成功');
  }
}
