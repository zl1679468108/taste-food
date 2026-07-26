import React from 'react';
import MediaPicker, { type MediaPickerProps } from '@/components/MediaPicker';
import { DEFAULT_SHOP_ID } from '@/utils/constants';

export type ImageUploadProps = MediaPickerProps;

/**
 * 菜品图片字段（兼容旧 import）
 * 主路径：图库选择；次要：单张上传
 */
const ImageUpload: React.FC<ImageUploadProps> = ({
  shopId = DEFAULT_SHOP_ID,
  allowSingleUpload = true,
  ...rest
}) => (
  <MediaPicker
    shopId={shopId}
    allowSingleUpload={allowSingleUpload}
    {...rest}
  />
);

export default ImageUpload;
