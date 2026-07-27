import {
  BadRequestException,
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Query,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { Roles } from '../../common/decorators/roles.decorator';
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

@Controller('storage')
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  /**
   * 单张上传（保留兼容）：form-data image + shop_id + originalName?
   */
  @Post('images/menu')
  @Roles(UserRole.ADMIN, UserRole.MERCHANT)
  @UseInterceptors(FileInterceptor('image'))
  async uploadMenuImage(
    @UploadedFile() file: any,
    @Body('originalName') originalName: string | undefined,
    @Body('shop_id') shopIdBody: string | undefined,
    @Body('shopId') shopIdCamel: string | undefined,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<ApiResponse<UploadImageResult>> {
    if (!file) {
      throw new BadRequestException('请选择图片文件');
    }

    const shopId = shopIdBody || shopIdCamel || user.shopId;
    const result = await this.storageService.uploadImage(
      file.buffer,
      originalName || file.originalname || 'image.jpg',
      shopId || '',
      user.userId,
      file.mimetype,
    );

    return success(result, '图片上传成功');
  }

  /**
   * 批量上传：form-data images[] + shop_id，上限 30
   */
  @Post('images/menu/batch')
  @Roles(UserRole.ADMIN, UserRole.MERCHANT)
  @UseInterceptors(FilesInterceptor('images', 30))
  async uploadMenuImagesBatch(
    @UploadedFiles() files: any[] | undefined,
    @Body('shop_id') shopIdBody: string | undefined,
    @Body('shopId') shopIdCamel: string | undefined,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<ApiResponse<BatchUploadResult>> {
    if (!files || files.length === 0) {
      throw new BadRequestException('请选择图片文件');
    }

    const shopId = shopIdBody || shopIdCamel || user.shopId;
    const result = await this.storageService.uploadImagesBatch(
      files.map((f) => ({
        buffer: f.buffer,
        originalName: f.originalname || 'image.jpg',
        mimeType: f.mimetype,
      })),
      shopId || '',
      user.userId,
    );

    return success(result, '批量上传完成');
  }

  /**
   * 门店图库列表（含菜品占用 usedBy）
   */
  @Get('images/menu')
  @Roles(UserRole.ADMIN, UserRole.MERCHANT)
  async listMenuImages(
    @Query('shop_id') shopIdQuery: string | undefined,
    @Query('shopId') shopIdCamel: string | undefined,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<ApiResponse<MediaAssetWithUsage[]>> {
    const shopId = shopIdQuery || shopIdCamel || user.shopId;
    const list = await this.storageService.listMedia(shopId || '');
    return success(list);
  }

  /**
   * 按素材 id 删除（仍被引用则 400）
   */
  @Delete('images/menu/:id')
  @Roles(UserRole.ADMIN, UserRole.MERCHANT)
  async deleteMenuMedia(
    @Param('id') id: string,
  ): Promise<ApiResponse<null>> {
    await this.storageService.deleteMedia(id);
    return success(null, '图片删除成功');
  }

  /**
   * 兼容旧接口：按 storage path 删除
   */
  @Delete('images/*path')
  @Roles(UserRole.ADMIN, UserRole.MERCHANT)
  async deleteImage(@Param('path') path: string): Promise<ApiResponse<null>> {
    await this.storageService.deleteImage(decodeURIComponent(path));
    return success(null, '图片删除成功');
  }
}
