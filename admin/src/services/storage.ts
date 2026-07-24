import axios from 'axios';
import { message } from 'antd';

export interface UploadImageResult {
  url: string;
  path: string;
}

/**
 * 上传菜品图片到 /api/storage/images/menu
 * 使用 FormData，字段名 image（与后端 FileInterceptor 对齐）
 */
export async function uploadMenuImage(file: File): Promise<UploadImageResult> {
  const formData = new FormData();
  formData.append('image', file);
  formData.append('originalName', file.name || 'image.jpg');

  const token = localStorage.getItem('token');
  const resp = await axios.post('/api/storage/images/menu', formData, {
    headers: {
      Authorization: token ? `Bearer ${token}` : '',
      // 让浏览器自动设置 multipart boundary
    },
    timeout: 30000,
  });

  const body = resp.data;
  if (!body || body.code !== 0 || !body.data?.url) {
    const msg = body?.message || '图片上传失败';
    message.error(msg);
    throw new Error(msg);
  }
  return body.data as UploadImageResult;
}
