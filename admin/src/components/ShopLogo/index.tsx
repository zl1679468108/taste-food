import React, { useEffect, useState } from 'react';
import { Image } from 'antd';
import { DEFAULT_SHOP_LOGO, resolveShopLogoUrl } from '@/utils/shop-logo';

export interface ShopLogoProps {
  src?: string | null;
  size?: number;
  alt?: string;
  className?: string;
  style?: React.CSSProperties;
  /** 是否使用 antd Image 预览 */
  preview?: boolean;
}

/**
 * 店铺 Logo：优先自定义 URL，空值或加载失败回退默认图
 */
const ShopLogo: React.FC<ShopLogoProps> = ({
  src,
  size = 40,
  alt = '店铺 Logo',
  className,
  style,
  preview = false,
}) => {
  const [currentSrc, setCurrentSrc] = useState(() => resolveShopLogoUrl(src));

  useEffect(() => {
    setCurrentSrc(resolveShopLogoUrl(src));
  }, [src]);

  return (
    <Image
      src={currentSrc}
      alt={alt}
      width={size}
      height={size}
      preview={preview ? { src: currentSrc } : false}
      fallback={DEFAULT_SHOP_LOGO}
      className={className}
      style={{
        objectFit: 'cover',
        borderRadius: 10,
        background: 'var(--tf-bg-muted, #f5f5f5)',
        flexShrink: 0,
        ...style,
      }}
      onError={() => {
        setCurrentSrc((prev) => (prev === DEFAULT_SHOP_LOGO ? prev : DEFAULT_SHOP_LOGO));
      }}
    />
  );
};

export default ShopLogo;
