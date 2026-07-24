import React, { useState } from 'react';
import { Upload, Button, Image, Space, Input, message } from 'antd';
import { UploadOutlined, DeleteOutlined } from '@ant-design/icons';
import type { UploadProps } from 'antd';
import { uploadMenuImage } from '@/services/storage';

interface ImageUploadProps {
  value?: string;
  onChange?: (url: string) => void;
}

/**
 * 菜品图片字段：本地上传 + 可选 URL 粘贴
 * 适配 Form.Item value/onChange
 */
const ImageUpload: React.FC<ImageUploadProps> = ({ value, onChange }) => {
  const [uploading, setUploading] = useState(false);

  const beforeUpload: UploadProps['beforeUpload'] = async (file) => {
    const isImage = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'].includes(file.type);
    if (!isImage) {
      message.error('仅支持 jpg / png / webp 格式');
      return Upload.LIST_IGNORE;
    }
    if (file.size / 1024 / 1024 >= 5) {
      message.error('图片大小不能超过 5MB');
      return Upload.LIST_IGNORE;
    }

    setUploading(true);
    try {
      const result = await uploadMenuImage(file as File);
      onChange?.(result.url);
      message.success('上传成功');
    } catch (e) {
      console.error('上传失败:', e);
    } finally {
      setUploading(false);
    }
    return false;
  };

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="middle">
      {value ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Image
            src={value}
            width={96}
            height={96}
            style={{ objectFit: 'cover', borderRadius: 8 }}
          />
          <Button danger icon={<DeleteOutlined />} onClick={() => onChange?.('')}>
            移除
          </Button>
        </div>
      ) : null}

      <Upload
        accept="image/jpeg,image/png,image/webp"
        showUploadList={false}
        beforeUpload={beforeUpload}
        maxCount={1}
      >
        <Button icon={<UploadOutlined />} loading={uploading}>
          {value ? '重新上传' : '上传图片'}
        </Button>
      </Upload>

      <Input
        allowClear
        placeholder="或粘贴图片 URL：https://..."
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
      />
    </Space>
  );
};

export default ImageUpload;
