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
  ForbiddenException,
} from '@nestjs/common';
import { PromotionService } from './promotion.service';
import { CreatePromotionDto, UpdatePromotionDto, PromotionResponseDto } from './dto/promotion.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../common/constants/enums';
import { DEFAULT_SHOP_ID } from '../../common/constants/shop';
import { success, ApiResponse } from '../../common/interfaces/api-response.interface';

@Controller('promotions')
export class PromotionController {
  constructor(private readonly promotionService: PromotionService) {}

  private requireAdminShopId(shopId?: string): string {
    if (!shopId) {
      throw new ForbiddenException('管理员账号未绑定店铺');
    }
    return shopId;
  }

  /**
   * GET /api/promotions/manage
   * 管理端查询本店全部活动，包含未生效、已过期和已停用记录。
   */
  @Get('manage')
  @Roles(UserRole.ADMIN)
  async findAllForManagement(
    @CurrentUser('shopId') userShopId?: string,
  ): Promise<ApiResponse<PromotionResponseDto[]>> {
    const promotions = await this.promotionService.findAllForManagement(
      this.requireAdminShopId(userShopId),
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
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreatePromotionDto,
    @CurrentUser('shopId') userShopId?: string,
  ): Promise<ApiResponse<PromotionResponseDto>> {
    // 多租户隔离：admin 只能为自己绑定的店铺创建促销，不信任客户端传入的 shopId
    dto.shopId = userShopId || DEFAULT_SHOP_ID;
    const promotion = await this.promotionService.create(dto);
    return success(promotion, '促销创建成功');
  }

  /**
   * PATCH /api/promotions/:id
   * 更新促销活动（需 Admin 认证）
   */
  @Patch(':id')
  @Roles(UserRole.ADMIN)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdatePromotionDto,
    @CurrentUser('shopId') userShopId?: string,
  ): Promise<ApiResponse<PromotionResponseDto>> {
    const promotion = await this.promotionService.update(
      id,
      dto,
      this.requireAdminShopId(userShopId),
    );
    return success(promotion, '促销更新成功');
  }

  /**
   * DELETE /api/promotions/:id
   * 删除促销活动（需 Admin 认证）
   */
  @Delete(':id')
  @Roles(UserRole.ADMIN)
  async remove(
    @Param('id') id: string,
    @CurrentUser('shopId') userShopId?: string,
  ): Promise<ApiResponse<null>> {
    await this.promotionService.remove(id, this.requireAdminShopId(userShopId));
    return success(null, '促销删除成功');
  }
}
