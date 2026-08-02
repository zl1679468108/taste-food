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
import {
  CreatePromotionDto,
  UpdatePromotionDto,
  PromotionResponseDto,
  PromotionConflictResultDto,
} from './dto/promotion.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { MerchantOnly } from '../../common/decorators/shop-scope.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../common/constants/enums';
import { resolveAdminTargetShopId } from '../../common/utils/admin-shop-scope';
import { success, ApiResponse } from '../../common/interfaces/api-response.interface';

/**
 * 顾客侧促销读取（公开，保持中性前缀，client/ 下单页依赖）。
 */
@Controller('promotions')
export class PromotionController {
  constructor(private readonly promotionService: PromotionService) {}

  /**
   * GET /api/promotions?shopId=xxx
   * 获取指定店铺当前可用的促销活动（公开接口）
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
}

/**
 * 商家促销管理（T300.5 迁入 /api/merchant 双入口前缀）。
 *
 * 管理态读写只服务商家后台，client/ 无调用，故整体迁前缀并 @MerchantOnly；
 * 顾客可见的促销列表仍在公开的 GET /api/promotions。
 */
@Controller('merchant/promotions')
@Roles(UserRole.ADMIN, UserRole.MERCHANT)
@MerchantOnly()
export class MerchantPromotionController {
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
   * GET /api/merchant/promotions/manage
   * 管理端查询本店全部活动，包含未生效、已过期和已停用记录。
   */
  @Get('manage')
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
   * GET /api/merchant/promotions/conflicts?shopId=&type=&startTime=&endTime=&excludeId=
   * 检测同店铺、同类型的促销时间段是否重叠。
   *
   * 语义为「警告」而非「阻断」：业务允许叠加促销，接口只负责如实返回重叠项，
   * 是否继续保存由前端交给用户决定。
   * 静态路由必须声明在参数路由之前，避免被通配路由抢占。
   */
  @Get('conflicts')
  async findConflicts(
    @Query('type') type: string,
    @Query('startTime') startTime?: string,
    @Query('endTime') endTime?: string,
    @Query('excludeId') excludeId?: string,
    @Query('shopId') queryShopId?: string,
    @Query('shop_id') queryShopIdSnake?: string,
    @CurrentUser('shopId') userShopId?: string,
  ): Promise<ApiResponse<PromotionConflictResultDto>> {
    // 商家锁定本店，平台管理员可指定目标店；越权访问在此被拦掉
    const shopId = this.resolveAdminShopId(userShopId, queryShopId || queryShopIdSnake);
    const conflicts = await this.promotionService.findConflicts({
      shopId,
      type,
      startTime,
      endTime,
      excludeId,
    });
    return success({ hasConflict: conflicts.length > 0, conflicts });
  }

  /**
   * POST /api/merchant/promotions
   * 创建促销活动
   */
  @Post()
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
   * PATCH /api/merchant/promotions/:id
   * 更新促销活动
   */
  @Patch(':id')
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
   * DELETE /api/merchant/promotions/:id
   * 删除促销活动
   */
  @Delete(':id')
  async remove(
    @Param('id') id: string,
    @Query('shop_id') queryShopId?: string,
    @CurrentUser('shopId') userShopId?: string,
  ): Promise<ApiResponse<null>> {
    await this.promotionService.remove(id, this.resolveAdminShopId(userShopId, queryShopId));
    return success(null, '促销删除成功');
  }
}
