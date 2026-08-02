import {
  BadRequestException,
  Controller,
  Post,
  Get,
  Delete,
  Body,
  ForbiddenException,
  Param,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { Roles } from '../../common/decorators/roles.decorator';
import { MerchantOnly } from '../../common/decorators/shop-scope.decorator';
import {
  CurrentUser,
  CurrentUserPayload,
} from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../common/constants/enums';
import { success, ApiResponse } from '../../common/interfaces/api-response.interface';
import {
  StorageService,
  UploadImageResult,
  BatchUploadResult,
  MediaAssetWithUsage,
} from './storage.service';

/**
 * 素材库接口。
 *
 * 路由刻意保持中性前缀 `/api/storage/**`：client/ 的骑手送达凭证上传与
 * 小程序端菜单管理页都直接调用这些地址，改名会破坏 client/。
 * 作用域隔离改由 @MerchantOnly + 强制 JWT shopId 保证。
 */
@Controller('storage')
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  /**
   * 取当前商家绑定店铺。一律以 JWT 为准，忽略请求体/查询串传入的 shop_id，
   * 避免商家通过 body 覆盖写入他店素材。
   */
  private requireMerchantShopId(user: CurrentUserPayload): string {
    const shopId = (user.shopId || '').trim();
    if (!shopId) {
      throw new ForbiddenException('当前账号未绑定店铺');
    }
    return shopId;
  }

  /**
   * 单张上传：form-data image + originalName?
   * 目标店铺取 JWT 绑定店，不接受请求体覆盖。
   */
  @Post('images/menu')
  @Roles(UserRole.ADMIN, UserRole.MERCHANT)
  @MerchantOnly()
  @UseInterceptors(FileInterceptor('image'))
  async uploadMenuImage(
    @UploadedFile() file: any,
    @Body('originalName') originalName: string | undefined,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<ApiResponse<UploadImageResult>> {
    if (!file) {
      throw new BadRequestException('请选择图片文件');
    }

    const shopId = this.requireMerchantShopId(user);
    const result = await this.storageService.uploadImage(
      file.buffer,
      originalName || file.originalname || 'image.jpg',
      shopId,
      user.userId,
      file.mimetype,
    );

    return success(result, '图片上传成功');
  }


  /**
   * 骑手送达凭证照片：form-data image + orderId + shop_id
   */
  @Post('images/delivery-proof')
  @Roles(UserRole.RIDER, UserRole.ADMIN)
  @UseInterceptors(FileInterceptor('image'))
  async uploadDeliveryProof(
    @UploadedFile() file: any,
    @Body('originalName') originalName: string | undefined,
    @Body('orderId') orderIdBody: string | undefined,
    @Body('order_id') orderIdSnake: string | undefined,
    @Body('shop_id') shopIdBody: string | undefined,
    @Body('shopId') shopIdCamel: string | undefined,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<ApiResponse<UploadImageResult>> {
    if (!file) {
      throw new BadRequestException('请选择图片文件');
    }
    const orderId = (orderIdBody || orderIdSnake || '').trim();
    if (!orderId) {
      throw new BadRequestException('orderId 不能为空');
    }
    // 骑手跨店取餐、不绑店，只能由请求给出目标店；
    // 若调用方已绑店（商家/店内 admin），一律以 JWT 为准，禁止 body 覆盖。
    const shopId = user.shopId || shopIdBody || shopIdCamel || '';
    const result = await this.storageService.uploadDeliveryProof(
      file.buffer,
      originalName || file.originalname || 'proof.jpg',
      shopId,
      orderId,
      user.userId,
      file.mimetype,
    );
    return success(result, '送达照片上传成功');
  }

  /**
   * 批量上传：form-data images[] + shop_id，上限 30
   */
  @Post('images/menu/batch')
  @Roles(UserRole.ADMIN, UserRole.MERCHANT)
  @MerchantOnly()
  @UseInterceptors(FilesInterceptor('images', 30))
  async uploadMenuImagesBatch(
    @UploadedFiles() files: any[] | undefined,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<ApiResponse<BatchUploadResult>> {
    if (!files || files.length === 0) {
      throw new BadRequestException('请选择图片文件');
    }

    const shopId = this.requireMerchantShopId(user);
    const result = await this.storageService.uploadImagesBatch(
      files.map((f) => ({
        buffer: f.buffer,
        originalName: f.originalname || 'image.jpg',
        mimeType: f.mimetype,
      })),
      shopId,
      user.userId,
    );

    return success(result, '批量上传完成');
  }

  /**
   * 门店图库列表（含菜品占用 usedBy）。只返回本店素材。
   */
  @Get('images/menu')
  @Roles(UserRole.ADMIN, UserRole.MERCHANT)
  @MerchantOnly()
  async listMenuImages(
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<ApiResponse<MediaAssetWithUsage[]>> {
    const shopId = this.requireMerchantShopId(user);
    const list = await this.storageService.listMedia(shopId);
    return success(list);
  }

  /**
   * 按素材 id 删除（非本店素材按「不存在」处理；仍被引用则 400）
   */
  @Delete('images/menu/:id')
  @Roles(UserRole.ADMIN, UserRole.MERCHANT)
  @MerchantOnly()
  async deleteMenuMedia(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<ApiResponse<null>> {
    await this.storageService.deleteMedia(id, this.requireMerchantShopId(user));
    return success(null, '图片删除成功');
  }

  /**
   * 兼容旧接口：按 storage path 删除（仅限本店路径）
   */
  @Delete('images/*path')
  @Roles(UserRole.ADMIN, UserRole.MERCHANT)
  @MerchantOnly()
  async deleteImage(
    @Param('path') path: string,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<ApiResponse<null>> {
    await this.storageService.deleteImage(
      decodeURIComponent(path),
      this.requireMerchantShopId(user),
    );
    return success(null, '图片删除成功');
  }
}
