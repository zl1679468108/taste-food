import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { supabase, hasSupabase } from '../../database/supabase.client';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly BUCKET = 'menu-images';
  private readonly MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

  private generateFileName(originalName: string, userId: string): string {
    const ext = originalName.split('.').pop() || 'jpg';
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `${userId}/${timestamp}-${random}.${ext}`;
  }

  async uploadImage(
    buffer: Buffer,
    originalName: string,
    userId: string,
  ): Promise<{ url: string; path: string }> {
    if (!hasSupabase() || !supabase) {
      throw new BadRequestException('存储服务不可用');
    }

    // 文件大小限制
    if (buffer.length > this.MAX_FILE_SIZE) {
      throw new BadRequestException('图片大小不能超过 5MB');
    }

    // 文件格式限制
    const allowedExtensions = ['jpg', 'jpeg', 'png', 'webp'];
    const ext = originalName.split('.').pop()?.toLowerCase() || 'jpg';
    if (!allowedExtensions.includes(ext)) {
      throw new BadRequestException('不支持的图片格式，请上传 jpg、png 或 webp 格式的图片');
    }

    // 根据扩展名确定 MIME 类型
    const mimeMap: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      webp: 'image/webp',
    };
    const contentType = mimeMap[ext] || 'image/jpeg';

    const fileName = this.generateFileName(originalName, userId);

    const { data, error } = await supabase.storage
      .from(this.BUCKET)
      .upload(fileName, buffer, {
        contentType,
        upsert: false,
      });

    if (error) {
      this.logger.error('[Storage] 上传失败:', error);
      throw new BadRequestException(`图片上传失败: ${error.message}`);
    }

    const { data: urlData } = supabase.storage
      .from(this.BUCKET)
      .getPublicUrl(fileName);

    return {
      url: urlData?.publicUrl || '',
      path: data.path,
    };
  }

  async deleteImage(path: string): Promise<void> {
    if (!hasSupabase() || !supabase) return;
    const { error } = await supabase.storage
      .from(this.BUCKET)
      .remove([path]);
    if (error) {
      this.logger.error('[Storage] 删除失败:', error);
      throw new BadRequestException(`图片删除失败: ${error.message}`);
    }
  }
}
