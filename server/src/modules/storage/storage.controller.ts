import { Controller, Post, Delete, UseGuards, Body, Param, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '../../common/guards/auth.guard';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { success, ApiResponse } from '../../common/interfaces/api-response.interface';
import { StorageService } from './storage.service';

@Controller('storage')
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  @Post('images/menu')
  @UseGuards(AuthGuard)
  @UseInterceptors(FileInterceptor('image'))
  async uploadMenuImage(
    @UploadedFile() file: any,
    @Body('originalName') originalName: string,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<ApiResponse<{ url: string; path: string }>> {
    if (!file) {
      return success({ url: '', path: '' }, '请选择图片文件');
    }

    const result = await this.storageService.uploadImage(
      file.buffer,
      originalName || 'image.jpg',
      user.userId,
    );

    return success(result, '图片上传成功');
  }

  @Delete('images/:path')
  @UseGuards(AuthGuard)
  async deleteImage(@Param('path') path: string): Promise<ApiResponse<null>> {
    await this.storageService.deleteImage(decodeURIComponent(path));
    return success(null, '图片删除成功');
  }
}
