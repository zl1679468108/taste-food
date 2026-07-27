import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { PromotionService } from './promotion.service';
import { CreatePromotionDto, UpdatePromotionDto, PromotionResponseDto } from './dto/promotion.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../common/constants/enums';
import { resolveAdminTargetShopId } from '../../common/utils/admin-shop-scope';
import { success, ApiResponse } from '../../common/interfaces/api-response.interface';

@Controller('promotions')
export class PromotionController {
  constructor(private readonly promotionService: PromotionService) {}

  /**
   * 商家（有绑定 shopId）强制本店；
   * 平台管理员（无绑定）可用 requestedShopId 指定目标店。
   */
  private resolveAdminShopId(userShopId?: string, requestedShopId?: string): string {
    return resolveAdminTargetShopId(userShopId, requestedShopId, {
      lockToBoundShop: !!userShopId,
    });
  }

  /**
   * GET /api/promotions/manage
   * 管理端查询本店全部活动，包含未生效、已过期和已停用记录。
   */
  @Get('manage')
  @Roles(UserRole.ADMIN, UserRole.MERCHANT)
  async findAllForManagement(
    @Query('shopId') queryShopId: string | undefined,
    @Query('shop_id') queryShopIdSnake: string | undefined,
    @CurrentUser('shopId') userShopId?: string,
  ): Promise<ApiResponse<PromotionResponseDto[]>> {
    const promotions = await this.promotionService.findAllForManagement(
      this.resolveAdminShopId(userShopId, queryShopId || queryShopIdSnake),
    );
    return success(promotions);
  }

  /**
   * GET /api/promotions?shopId=xxx
   * 获取指定店铺可用的促销活动（公开接口）
   */
  @Get()
  @Public()
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
  @Roles(UserRole.ADMIN, UserRole.MERCHANT)
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreatePromotionDto,
    @CurrentUser('shopId') userShopId?: string,
  ): Promise<ApiResponse<PromotionResponseDto>> {
    // 商家强制本店；平台管理员可用 body.shopId
    dto.shopId = this.resolveAdminShopId(userShopId, dto.shopId);
    const promotion = await this.promotionService.create(dto);
    return success(promotion, '促销创建成功');
  }

  /**
   * PATCH /api/promotions/:id
   * 更新促销活动（需 Admin 认证）
   */
  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.MERCHANT)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdatePromotionDto,
    @Query('shop_id') queryShopId?: string,
    @CurrentUser('shopId') userShopId?: string,
  ): Promise<ApiResponse<PromotionResponseDto>> {
    const promotion = await this.promotionService.update(
      id,
      dto,
      this.resolveAdminShopId(userShopId, queryShopId),
    );
    return success(promotion, '促销更新成功');
  }

  /**
   * DELETE /api/promotions/:id
   * 删除促销活动（需 Admin 认证）
   */
  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.MERCHANT)
  async remove(
    @Param('id') id: string,
    @Query('shop_id') queryShopId?: string,
    @CurrentUser('shopId') userShopId?: string,
  ): Promise<ApiResponse<null>> {
    await this.promotionService.remove(id, this.resolveAdminShopId(userShopId, queryShopId));
    return success(null, '促销删除成功');
  }
}
