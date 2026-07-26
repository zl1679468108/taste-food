import request from '@/utils/request';

export interface UploadImageResult {
  id: string;
  url: string;
  path: string;
  fileName?: string;
  mime?: string;
  sizeBytes?: number;
}

export interface BatchUploadResult {
  items: UploadImageResult[];
  failed: Array<{ fileName: string; reason: string }>;
  successCount: number;
  failCount: number;
}

export interface MediaUsage {
  id: string;
  name: string;
}

/** 图库资源（对接 GET /api/storage/images/menu，含 usedBy 占用） */
export interface MenuImageAsset {
  id: string;
  url: string;
  path?: string;
  shopId?: string;
  shop_id?: string;
  fileName?: string;
  file_name?: string;
  originalName?: string;
  original_name?: string;
  mime?: string;
  sizeBytes?: number;
  size_bytes?: number;
  /** 是否已被菜品引用（部分接口可能直接给） */
  used?: boolean;
  isUsed?: boolean;
  usedCount?: number;
  used_count?: number;
  usedBy?: MediaUsage[];
  used_by?: MediaUsage[];
  createdAt?: string;
  created_at?: string;
  updatedAt?: string;
  updated_at?: string;
}

export function isMenuImageUsed(asset: MenuImageAsset): boolean {
  if (typeof asset.used === 'boolean') return asset.used;
  if (typeof asset.isUsed === 'boolean') return asset.isUsed;
  const count = asset.usedCount ?? asset.used_count;
  if (typeof count === 'number') return count > 0;
  const refs = asset.usedBy ?? asset.used_by;
  if (Array.isArray(refs)) return refs.length > 0;
  return false;
}

export function getMenuImageName(asset: MenuImageAsset): string {
  return (
    asset.fileName ||
    asset.file_name ||
    asset.originalName ||
    asset.original_name ||
    ''
  );
}

function normalizeList(data: unknown): MenuImageAsset[] {
  if (Array.isArray(data)) return data as MenuImageAsset[];
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj.list)) return obj.list as MenuImageAsset[];
    if (Array.isArray(obj.items)) return obj.items as MenuImageAsset[];
    if (Array.isArray(obj.data)) return obj.data as MenuImageAsset[];
  }
  return [];
}

/**
 * 图库列表
 * GET /api/storage/images/menu?shop_id=
 */
export async function listMenuImages(shopId: string): Promise<MenuImageAsset[]> {
  const data = (await request.get('/api/storage/images/menu', {
    params: { shop_id: shopId },
  })) as unknown;
  return normalizeList(data);
}

/**
 * 单张上传菜品图
 * POST /api/storage/images/menu  FormData: image + shop_id + originalName
 */
export async function uploadMenuImage(
  file: File,
  shopId?: string,
): Promise<UploadImageResult> {
  const formData = new FormData();
  formData.append('image', file);
  formData.append('originalName', file.name || 'image.jpg');
  if (shopId) {
    formData.append('shop_id', shopId);
  }

  return request.post('/api/storage/images/menu', formData, {
    timeout: 30000,
  }) as Promise<UploadImageResult>;
}

/**
 * 批量导入图库
 * POST /api/storage/images/menu/batch  FormData: images + shop_id
 * 后端 FilesInterceptor('images', 30)
 */
export async function batchUploadMenuImages(
  files: File[],
  shopId: string,
): Promise<BatchUploadResult> {
  if (!files.length) {
    return { items: [], failed: [], successCount: 0, failCount: 0 };
  }

  const formData = new FormData();
  files.forEach((file) => {
    formData.append('images', file);
  });
  formData.append('shop_id', shopId);

  const data = (await request.post('/api/storage/images/menu/batch', formData, {
    timeout: 120000,
  })) as BatchUploadResult | UploadImageResult[] | unknown;

  if (Array.isArray(data)) {
    return {
      items: data as UploadImageResult[],
      failed: [],
      successCount: data.length,
      failCount: 0,
    };
  }

  if (data && typeof data === 'object') {
    const obj = data as Partial<BatchUploadResult>;
    const items = Array.isArray(obj.items) ? obj.items : [];
    const failed = Array.isArray(obj.failed) ? obj.failed : [];
    return {
      items,
      failed,
      successCount: typeof obj.successCount === 'number' ? obj.successCount : items.length,
      failCount: typeof obj.failCount === 'number' ? obj.failCount : failed.length,
    };
  }

  return { items: [], failed: [], successCount: 0, failCount: 0 };
}

/**
 * 删除图库图片
 * DELETE /api/storage/images/menu/:id
 */
export async function deleteMenuImage(id: string): Promise<void> {
  await request.delete(`/api/storage/images/menu/${encodeURIComponent(id)}`);
}
