import { memo, useEffect, useMemo, useState } from 'react';
import { View, Image } from '@tarojs/components';
import { DEFAULT_SHOP_LOGO } from '../../utils/shop-logo';
import './index.scss';

interface ShopLogoProps {
  src?: string | null;
  size?: number;
  className?: string;
  alt?: string;
}

function buildCandidates(src?: string | null): string[] {
  const list: string[] = [];
  const remote = (src || '').trim();
  if (remote) list.push(remote);
  list.push(DEFAULT_SHOP_LOGO);
  return list;
}

function ShopLogoInner({
  src,
  size = 52,
  className = '',
  alt = '店铺 Logo',
}: ShopLogoProps) {
  const candidates = useMemo(() => buildCandidates(src), [src]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [src]);

  const safeIndex = Math.min(index, candidates.length - 1);
  const imageSrc = candidates[safeIndex] || DEFAULT_SHOP_LOGO;
  const isDefault = imageSrc === DEFAULT_SHOP_LOGO;

  return (
    <View
      className={`shop-logo${isDefault ? ' shop-logo--default' : ''} ${className}`.trim()}
      style={{ width: size, height: size }}
    >
      <Image
        className='shop-logo__img'
        src={imageSrc}
        mode='aspectFill'
        lazyLoad
        aria-label={alt}
        onError={() => {
          setIndex((prev) => (prev + 1 < candidates.length ? prev + 1 : prev));
        }}
      />
    </View>
  );
}

export default memo(ShopLogoInner);
