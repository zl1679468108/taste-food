import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { supabase, hasSupabase } from '../../database/supabase.client';
import { assertMemoryFallbackAllowed } from '../../common/utils/memory-guard';

export interface MediaAsset {
  id: string;
  shopId: string;
  url: string;
  path: string;
  fileName: string;
  mime: string;
  sizeBytes: number;
  createdAt: string;
  updatedAt: string;
}

export interface MediaUsage {
  id: string;
  name: string;
}

export interface MediaAssetWithUsage extends MediaAsset {
  usedBy: MediaUsage[];
}

export interface UploadImageResult {
  id: string;
  url: string;
  path: string;
  fileName: string;
  mime: string;
  sizeBytes: number;
}

export interface BatchUploadResult {
  items: UploadImageResult[];
  failed: Array<{ fileName: string; reason: string }>;
  successCount: number;
  failCount: number;
}

interface MediaAssetRow {
  id: string;
  shop_id: string;
  url: string;
  path: string;
  file_name: string | null;
  mime: string | null;
  size_bytes: number | null;
  created_at: string;
  updated_at: string;
}

/** 开发环境内存元数据回退（无 Supabase / 表写入失败时） */
const memoryMediaAssets: Map<string, MediaAsset> = new Map();

const ALLOWED_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp']);
const MIME_MAP: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};
const MAX_BATCH_SIZE = 30;

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly BUCKET = 'menu-images';
  private readonly MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

  private generateFileName(originalName: string, shopId: string): string {
    const ext = this.normalizeExt(originalName);
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `${shopId}/${timestamp}-${random}.${ext}`;
  }

  private normalizeExt(originalName: string): string {
    const raw = originalName.split('.').pop()?.toLowerCase() || 'jpg';
    return raw === 'jpeg' ? 'jpg' : raw;
  }

  private resolveMime(ext: string, providedMime?: string): string {
    if (providedMime && providedMime.startsWith('image/')) {
      return providedMime;
    }
    return MIME_MAP[ext] || 'image/jpeg';
  }

  private validateImageFile(
    buffer: Buffer,
    originalName: string,
  ): { ext: string; mime: string } {
    if (!buffer || buffer.length === 0) {
      throw new BadRequestException('图片内容为空');
    }
    if (buffer.length > this.MAX_FILE_SIZE) {
      throw new BadRequestException('图片大小不能超过 5MB');
    }

    const ext = originalName.split('.').pop()?.toLowerCase() || 'jpg';
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      throw new BadRequestException(
        '不支持的图片格式，请上传 jpg、png 或 webp 格式的图片',
      );
    }

    return {
      ext: ext === 'jpeg' ? 'jpg' : ext,
      mime: MIME_MAP[ext] || 'image/jpeg',
    };
  }

  private requireShopId(shopId?: string): string {
    const id = (shopId || '').trim();
    if (!id) {
      throw new BadRequestException('shop_id 不能为空');
    }
    return id;
  }

  private mapRow(row: MediaAssetRow): MediaAsset {
    return {
      id: row.id,
      shopId: row.shop_id,
      url: row.url,
      path: row.path,
      fileName: row.file_name || '',
      mime: row.mime || '',
      sizeBytes: row.size_bytes ?? 0,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private toMemoryAsset(input: {
    id?: string;
    shopId: string;
    url: string;
    path: string;
    fileName: string;
    mime: string;
    sizeBytes: number;
  }): MediaAsset {
    const now = new Date().toISOString();
    return {
      id: input.id || uuidv4(),
      shopId: input.shopId,
      url: input.url,
      path: input.path,
      fileName: input.fileName,
      mime: input.mime,
      sizeBytes: input.sizeBytes,
      createdAt: now,
      updatedAt: now,
    };
  }

  private async persistAssetMeta(asset: MediaAsset): Promise<MediaAsset> {
    if (hasSupabase() && supabase) {
      try {
        const { data, error } = await supabase
          .from('tf_media_assets')
          .insert({
            id: asset.id,
            shop_id: asset.shopId,
            url: asset.url,
            path: asset.path,
            file_name: asset.fileName,
            mime: asset.mime,
            size_bytes: asset.sizeBytes,
            created_at: asset.createdAt,
            updated_at: asset.updatedAt,
          })
          .select('*')
          .single();

        if (error) {
          this.logger.warn(
            `[Storage] 写入 tf_media_assets 失败，回退内存: ${error.message}`,
          );
        } else if (data) {
          const mapped = this.mapRow(data as MediaAssetRow);
          memoryMediaAssets.set(mapped.id, mapped);
          return mapped;
        }
      } catch (e) {
        this.logger.warn('[Storage] 写入 tf_media_assets 异常，回退内存:', e);
      }
    }

    assertMemoryFallbackAllowed('StorageService.persistAssetMeta');
    memoryMediaAssets.set(asset.id, asset);
    return asset;
  }

  private async findAssetById(id: string): Promise<MediaAsset | null> {
    if (hasSupabase() && supabase) {
      try {
        const { data, error } = await supabase
          .from('tf_media_assets')
          .select('*')
          .eq('id', id)
          .maybeSingle();

        if (error) {
          this.logger.warn(`[Storage] 查询素材失败: ${error.message}`);
        } else if (data) {
          return this.mapRow(data as MediaAssetRow);
        }
      } catch (e) {
        this.logger.warn('[Storage] 查询素材异常:', e);
      }
    }

    return memoryMediaAssets.get(id) || null;
  }

  private async findUsagesByUrls(
    shopId: string,
    urls: string[],
  ): Promise<Map<string, MediaUsage[]>> {
    const usageMap = new Map<string, MediaUsage[]>();
    if (urls.length === 0) {
      return usageMap;
    }

    if (hasSupabase() && supabase) {
      try {
        const { data, error } = await supabase
          .from('tf_menu_items')
          .select('id, name, image_url')
          .eq('shop_id', shopId)
          .in('image_url', urls);

        if (error) {
          this.logger.warn(`[Storage] 查询菜品占用失败: ${error.message}`);
        } else {
          for (const item of data || []) {
            const url = (item as { image_url?: string }).image_url || '';
            if (!url) continue;
            const list = usageMap.get(url) || [];
            list.push({
              id: (item as { id: string }).id,
              name: (item as { name: string }).name,
            });
            usageMap.set(url, list);
          }
          return usageMap;
        }
      } catch (e) {
        this.logger.warn('[Storage] 查询菜品占用异常:', e);
      }
    }

    return usageMap;
  }

  /**
   * 上传单张菜品图片到 menu-images 桶，路径 {shopId}/{timestamp}-{rand}.ext
   * 成功后写入 tf_media_assets（无 Supabase 时开发环境回退内存元数据）
   */
  async uploadImage(
    buffer: Buffer,
    originalName: string,
    shopId: string,
    _userId?: string,
    mimeType?: string,
  ): Promise<UploadImageResult> {
    const resolvedShopId = this.requireShopId(shopId);
    const { ext, mime: fallbackMime } = this.validateImageFile(
      buffer,
      originalName || 'image.jpg',
    );
    const mime = this.resolveMime(ext, mimeType || fallbackMime);
    const fileName = originalName || `image.${ext}`;
    const storagePath = this.generateFileName(fileName, resolvedShopId);

    if (!hasSupabase() || !supabase) {
      // 无对象存储时无法真正落盘；开发环境写入内存元数据（url 为占位）
      assertMemoryFallbackAllowed('StorageService.uploadImage');
      const placeholderUrl = `memory://${this.BUCKET}/${storagePath}`;
      const asset = this.toMemoryAsset({
        shopId: resolvedShopId,
        url: placeholderUrl,
        path: storagePath,
        fileName,
        mime,
        sizeBytes: buffer.length,
      });
      memoryMediaAssets.set(asset.id, asset);
      this.logger.warn(
        `[Storage] Supabase 不可用，使用内存占位图: ${placeholderUrl}`,
      );
      return {
        id: asset.id,
        url: asset.url,
        path: asset.path,
        fileName: asset.fileName,
        mime: asset.mime,
        sizeBytes: asset.sizeBytes,
      };
    }

    const { data, error } = await supabase.storage
      .from(this.BUCKET)
      .upload(storagePath, buffer, {
        contentType: mime,
        upsert: false,
      });

    if (error) {
      this.logger.error('[Storage] 上传失败:', error);
      throw new BadRequestException(`图片上传失败: ${error.message}`);
    }

    const { data: urlData } = supabase.storage
      .from(this.BUCKET)
      .getPublicUrl(storagePath);

    const url = urlData?.publicUrl || '';
    const asset = this.toMemoryAsset({
      shopId: resolvedShopId,
      url,
      path: data?.path || storagePath,
      fileName,
      mime,
      sizeBytes: buffer.length,
    });

    const saved = await this.persistAssetMeta(asset);

    return {
      id: saved.id,
      url: saved.url,
      path: saved.path,
      fileName: saved.fileName,
      mime: saved.mime,
      sizeBytes: saved.sizeBytes,
    };
  }

  /**
   * 批量上传，上限 30 张；单张失败不阻断其余文件
   */
  async uploadImagesBatch(
    files: Array<{
      buffer: Buffer;
      originalName: string;
      mimeType?: string;
    }>,
    shopId: string,
    userId?: string,
  ): Promise<BatchUploadResult> {
    const resolvedShopId = this.requireShopId(shopId);
    if (!files || files.length === 0) {
      throw new BadRequestException('请选择图片文件');
    }
    if (files.length > MAX_BATCH_SIZE) {
      throw new BadRequestException(`单次最多上传 ${MAX_BATCH_SIZE} 张图片`);
    }

    const items: UploadImageResult[] = [];
    const failed: Array<{ fileName: string; reason: string }> = [];

    for (const file of files) {
      const name = file.originalName || 'image.jpg';
      try {
        const result = await this.uploadImage(
          file.buffer,
          name,
          resolvedShopId,
          userId,
          file.mimeType,
        );
        items.push(result);
      } catch (e) {
        const reason =
          e instanceof Error ? e.message : '上传失败';
        failed.push({ fileName: name, reason });
      }
    }

    return {
      items,
      failed,
      successCount: items.length,
      failCount: failed.length,
    };
  }

  /**
   * 按 shop 列出素材，并附带同店 menu_items.image_url 占用信息
   */
  async listMedia(shopId: string): Promise<MediaAssetWithUsage[]> {
    const resolvedShopId = this.requireShopId(shopId);
    let assets: MediaAsset[] = [];

    if (hasSupabase() && supabase) {
      try {
        const { data, error } = await supabase
          .from('tf_media_assets')
          .select('*')
          .eq('shop_id', resolvedShopId)
          .order('created_at', { ascending: false });

        if (error) {
          this.logger.warn(`[Storage] 列表查询失败: ${error.message}`);
        } else {
          assets = (data || []).map((row) =>
            this.mapRow(row as MediaAssetRow),
          );
          // 同步到内存，便于 delete 时无 DB 也能命中
          for (const asset of assets) {
            memoryMediaAssets.set(asset.id, asset);
          }
        }
      } catch (e) {
        this.logger.warn('[Storage] 列表查询异常:', e);
      }
    }

    if (assets.length === 0) {
      if (!(hasSupabase() && supabase)) {
        assertMemoryFallbackAllowed('StorageService.listMedia');
      }
      assets = Array.from(memoryMediaAssets.values())
        .filter((item) => item.shopId === resolvedShopId)
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    }

    const usageMap = await this.findUsagesByUrls(
      resolvedShopId,
      assets.map((a) => a.url).filter(Boolean),
    );

    return assets.map((asset) => ({
      ...asset,
      usedBy: usageMap.get(asset.url) || [],
    }));
  }

  /**
   * 按素材 id 删除：仍被菜品引用则 400；否则删 storage + 资产行
   */
  async deleteMedia(id: string): Promise<void> {
    if (!id?.trim()) {
      throw new BadRequestException('素材 id 不能为空');
    }

    const asset = await this.findAssetById(id);
    if (!asset) {
      throw new NotFoundException('素材不存在');
    }

    const usageMap = await this.findUsagesByUrls(asset.shopId, [asset.url]);
    const usedBy = usageMap.get(asset.url) || [];
    if (usedBy.length > 0) {
      const names = usedBy.map((u) => u.name).join('、');
      throw new BadRequestException(
        `图片仍被菜品引用，无法删除：${names}`,
      );
    }

    // 删除对象存储文件（失败不阻断元数据清理，但记录日志）
    if (hasSupabase() && supabase && asset.path) {
      const { error } = await supabase.storage
        .from(this.BUCKET)
        .remove([asset.path]);
      if (error) {
        this.logger.error('[Storage] 删除对象失败:', error);
        throw new BadRequestException(`图片删除失败: ${error.message}`);
      }
    }

    if (hasSupabase() && supabase) {
      try {
        const { error } = await supabase
          .from('tf_media_assets')
          .delete()
          .eq('id', asset.id);
        if (error) {
          this.logger.warn(`[Storage] 删除素材行失败: ${error.message}`);
          throw new BadRequestException(`素材删除失败: ${error.message}`);
        }
      } catch (e) {
        if (e instanceof BadRequestException) throw e;
        this.logger.warn('[Storage] 删除素材行异常:', e);
        throw new BadRequestException('素材删除失败');
      }
    } else {
      assertMemoryFallbackAllowed('StorageService.deleteMedia');
    }

    memoryMediaAssets.delete(asset.id);
  }

  /**
   * 兼容旧接口：按 storage path 删除对象（不处理素材表）
   */
  async deleteImage(path: string): Promise<void> {
    if (!path?.trim()) {
      throw new BadRequestException('图片路径不能为空');
    }

    if (!hasSupabase() || !supabase) {
      // 尝试按 path 清理内存元数据
      for (const [id, asset] of memoryMediaAssets.entries()) {
        if (asset.path === path) {
          memoryMediaAssets.delete(id);
        }
      }
      return;
    }

    const { error } = await supabase.storage.from(this.BUCKET).remove([path]);
    if (error) {
      this.logger.error('[Storage] 删除失败:', error);
      throw new BadRequestException(`图片删除失败: ${error.message}`);
    }

    // 同步清理素材行（若存在）
    try {
      await supabase.from('tf_media_assets').delete().eq('path', path);
      for (const [id, asset] of memoryMediaAssets.entries()) {
        if (asset.path === path) {
          memoryMediaAssets.delete(id);
        }
      }
    } catch (e) {
      this.logger.warn('[Storage] 同步清理素材行失败:', e);
    }
  }
}
