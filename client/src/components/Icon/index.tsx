import { memo, useMemo } from 'react';
import { Image, View } from '@tarojs/components';
import './index.scss';

export type IconName =
  | 'heart'
  | 'heart-filled'
  | 'location'
  | 'search'
  | 'close'
  | 'shop'
  | 'clock'
  | 'check'
  | 'lock'
  | 'warning'
  | 'empty'
  | 'order'
  | 'cart'
  | 'menu'
  | 'food'
  | 'chat'
  | 'invoice'
  | 'star'
  | 'star-filled'
  | 'meat'
  | 'vegetable'
  | 'drink'
  | 'rice'
  | 'hot'
  | 'camera'
  | 'plus'
  | 'arrow-right'
  | 'list'
  | 'bell'
  | 'user'
  | 'users'
  | 'edit'
  | 'trash'
  | 'info';

interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  className?: string;
}

type PathFn = (color: string) => string;

/** 统一描边风格：圆角、2px 线宽，适配小尺寸清晰度 */
const S = (c: string) =>
  `fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"`;

const PATHS: Record<IconName, PathFn> = {
  heart: (c) =>
    `<path ${S(c)} d="M12 20.2S4.2 15.4 2.6 11.4C1.4 8.5 2.4 5.4 5.2 4.4c1.9-.7 4 .1 5.2 1.8 1.2-1.7 3.3-2.5 5.2-1.8 2.8 1 3.8 4.1 2.6 7-1.6 4-9.2 8.8-9.2 8.8z"/>`,

  'heart-filled': (c) =>
    `<path fill="${c}" stroke="${c}" stroke-width="1" stroke-linejoin="round" d="M12 20.2S4.2 15.4 2.6 11.4C1.4 8.5 2.4 5.4 5.2 4.4c1.9-.7 4 .1 5.2 1.8 1.2-1.7 3.3-2.5 5.2-1.8 2.8 1 3.8 4.1 2.6 7-1.6 4-9.2 8.8-9.2 8.8z"/>`,

  location: (c) =>
    `<path ${S(c)} d="M12 21s6.5-5.1 6.5-10.3a6.5 6.5 0 1 0-13 0C5.5 15.9 12 21 12 21z"/><circle cx="12" cy="10.5" r="2.3" fill="none" stroke="${c}" stroke-width="2"/>`,

  search: (c) =>
    `<circle cx="11" cy="11" r="6.2" fill="none" stroke="${c}" stroke-width="2"/><path ${S(c)} d="m16.2 16.2 4.3 4.3"/>`,

  close: (c) =>
    `<path ${S(c)} d="M6 6l12 12M18 6 6 18"/>`,

  // 清晰店面：顶棚 + 门面 + 门洞
  shop: (c) =>
    `<path ${S(c)} d="M3.5 10.5 5.5 4h13l2 6.5"/><path ${S(c)} d="M3 10.5h18"/><path ${S(c)} d="M4.5 10.5V20h15v-9.5"/><path ${S(c)} d="M10 20v-5.5h4V20"/><path ${S(c)} d="M7.5 14h2M14.5 14h2"/>`,

  clock: (c) =>
    `<circle cx="12" cy="12" r="8" fill="none" stroke="${c}" stroke-width="2"/><path ${S(c)} d="M12 8v4.3l3.2 1.9"/>`,

  check: (c) =>
    `<circle cx="12" cy="12" r="8" fill="none" stroke="${c}" stroke-width="2"/><path ${S(c)} d="m8.2 12.2 2.7 2.7 5-5.2"/>`,

  lock: (c) =>
    `<rect x="5" y="11" width="14" height="9.5" rx="2" fill="none" stroke="${c}" stroke-width="2"/><path ${S(c)} d="M8 11V8a4 4 0 0 1 8 0v3"/>`,

  warning: (c) =>
    `<path ${S(c)} d="M12 4.2 21 19.5H3L12 4.2z"/><path ${S(c)} d="M12 10v4.2M12 16.8h.01"/>`,

  empty: (c) =>
    `<path ${S(c)} d="M3.5 9.5 12 4.5l8.5 5V19a1.5 1.5 0 0 1-1.5 1.5h-14A1.5 1.5 0 0 1 3.5 19V9.5z"/><path ${S(c)} d="M3.5 9.5 12 14.5l8.5-5M12 14.5V20.5"/>`,

  // 订单小票
  order: (c) =>
    `<path ${S(c)} d="M7 3.5h10a1.5 1.5 0 0 1 1.5 1.5v15.2l-2.3-1.5-2.4 1.5-2.3-1.5-2.4 1.5-2.3-1.5-2.3 1.5V5A1.5 1.5 0 0 1 7 3.5z"/><path ${S(c)} d="M9 8.5h6M9 12h6M9 15.5h3.5"/>`,

  // 购物袋（购物车语义）
  cart: (c) =>
    `<path ${S(c)} d="M6.2 8.5h11.6l-.9 11.2a1.8 1.8 0 0 1-1.8 1.6H8.9a1.8 1.8 0 0 1-1.8-1.6L6.2 8.5z"/><path ${S(c)} d="M9 8.5V7a3 3 0 0 1 6 0v1.5"/>`,

  // 刀叉（菜单语义）
  menu: (c) =>
    `<path ${S(c)} d="M7 3.5v6.2a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2V3.5"/><path ${S(c)} d="M9 11.7V20.5M15.5 3.5V20.5M15.5 3.5c2.2 0 3 1.8 3 3.8S17.7 11 15.5 11"/>`,

  // 热气碗：蒸汽用曲线，避免被看成插座插头
  food: (c) =>
    `<path ${S(c)} d="M4.5 13h15a6.2 6.2 0 0 1-6.2 6.2h-2.6A6.2 6.2 0 0 1 4.5 13z"/><path ${S(c)} d="M4.5 13c0-1.2 3.3-2.2 7.5-2.2s7.5 1 7.5 2.2"/><path ${S(c)} d="M9 7.2c.5 1 .5 1.8 0 2.6M12 5.8c.5 1 .5 1.8 0 2.6M15 7.2c.5 1 .5 1.8 0 2.6"/>`,

  chat: (c) =>
    `<path ${S(c)} d="M5 5.5h14a2 2 0 0 1 2 2v7.2a2 2 0 0 1-2 2h-5.2L8.5 20v-3.3H5a2 2 0 0 1-2-2V7.5a2 2 0 0 1 2-2z"/>`,

  invoice: (c) =>
    `<path ${S(c)} d="M7 3.5h10v17l-2.5-1.6L12 20.5l-2.5-1.6L7 20.5v-17z"/><path ${S(c)} d="M10 8.5h4M10 12h4M10 15.5h2.5"/>`,

  star: (c) =>
    `<path ${S(c)} d="M12 3.8l2.4 4.9 5.4.8-3.9 3.8.9 5.4L12 16.2 7.2 18.7l.9-5.4-3.9-3.8 5.4-.8L12 3.8z"/>`,

  // 烤肉串：斜向签子 + 肉块，避免被看成定位针
  meat: (c) =>
    `<path ${S(c)} d="M4.2 19.8 19.8 4.2"/><path ${S(c)} d="M8.2 13.2c1.4-1.4 3.2-1.4 4.4-.2s1.2 3-.2 4.4-3.2 1.4-4.4.2-1.2-3 .2-4.4z"/><path ${S(c)} d="M12.4 9c1.4-1.4 3.2-1.4 4.4-.2s1.2 3-.2 4.4-3.2 1.4-4.4.2-1.2-3 .2-4.4z"/><path ${S(c)} d="M18.4 5.6l1.4-1.4"/>`,

  // 叶子：侧视叶形 + 叶脉，避免水滴感
  vegetable: (c) =>
    `<path ${S(c)} d="M12 20.5s-7.5-3.2-7.5-10.2C4.5 6.2 8 3.5 12 3.5c0 3.8-1 6.5-3 8.5"/><path ${S(c)} d="M12 3.5c4 0 7.5 2.7 7.5 6.8 0 7-7.5 10.2-7.5 10.2"/><path ${S(c)} d="M12 3.5C13 7.8 13 12 12 20.5"/>`,

  // 饮料杯 + 吸管
  drink: (c) =>
    `<path ${S(c)} d="M8 6.5h8l-1.1 12.2a2 2 0 0 1-2 1.8h-1.8a2 2 0 0 1-2-1.8L8 6.5z"/><path ${S(c)} d="M7.5 6.5h9"/><path ${S(c)} d="M14.2 6.5V3.8h2"/><path ${S(c)} d="M9.2 10.5h5.6"/>`,

  // 饭碗 + 筷子
  rice: (c) =>
    `<path ${S(c)} d="M5 13.2h14a5.8 5.8 0 0 1-5.8 5.8H10.8A5.8 5.8 0 0 1 5 13.2z"/><path ${S(c)} d="M6.2 13.2c0-3 2.5-5.2 5.8-5.2s5.8 2.2 5.8 5.2"/><path ${S(c)} d="M15.2 4.2 19 9.2M17.2 3.6 21 8.6"/>`,

  // 火焰
  hot: (c) =>
    `<path ${S(c)} d="M12 21c-3.6 0-6.2-2.5-6.2-6 0-2.6 1.5-4.2 3.1-5.8.4 1.8 1.8 2.9 1.8 2.9S10 8.4 12.4 5c2.8 2 5 4.6 5 8.4 0 3.8-2.5 7.6-5.4 7.6z"/><path ${S(c)} d="M11.2 18.2c-1.3-.4-2.2-1.6-2.2-3 0-1.4.8-2.2 1.6-3 .2.9.9 1.5.9 1.5s-.2-1.4 1.1-2.8c1.3 1.1 2.2 2.2 2.2 3.9 0 2-1.5 3.4-3.6 3.4z"/>`,

  camera: (c) =>
    `<path ${S(c)} d="M4 8.5h3.2l1.4-2h6.8l1.4 2H20a1 1 0 0 1 1 1V18a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.2" r="3.2" fill="none" stroke="${c}" stroke-width="2"/>`,

  plus: (c) =>
    `<path ${S(c)} d="M12 5v14M5 12h14"/>`,

  'arrow-right': (c) =>
    `<path ${S(c)} d="m9 6 6 6-6 6"/>`,

  list: (c) =>
    `<path ${S(c)} d="M9.5 7H20M9.5 12H20M9.5 17H20"/><circle cx="5.5" cy="7" r="1.2" fill="${c}"/><circle cx="5.5" cy="12" r="1.2" fill="${c}"/><circle cx="5.5" cy="17" r="1.2" fill="${c}"/>`,

  'star-filled': (c) =>
    `<path fill="${c}" stroke="${c}" stroke-width="1" stroke-linejoin="round" d="M12 3.8l2.4 4.9 5.4.8-3.9 3.8.9 5.4L12 16.2 7.2 18.7l.9-5.4-3.9-3.8 5.4-.8L12 3.8z"/>`,

  bell: (c) =>
    `<path ${S(c)} d="M6 17h12l-1.3-2.4V10a4.7 4.7 0 1 0-9.4 0v4.6L6 17z"/><path ${S(c)} d="M10 17a2 2 0 0 0 4 0"/><path ${S(c)} d="M12 4.2V3.2"/>`,

  user: (c) =>
    `<circle cx="12" cy="8" r="3.4" fill="none" stroke="${c}" stroke-width="2"/><path ${S(c)} d="M5 19.5c1.6-3.3 4.1-5 7-5s5.4 1.7 7 5"/>`,

  users: (c) =>
    `<circle cx="9" cy="8.2" r="3" fill="none" stroke="${c}" stroke-width="2"/><path ${S(c)} d="M3.2 19c1.3-2.8 3.3-4.3 5.8-4.3"/><circle cx="16.2" cy="9" r="2.5" fill="none" stroke="${c}" stroke-width="2"/><path ${S(c)} d="M12.2 19c.9-2.3 2.6-3.6 4.5-3.6 2 0 3.7 1.3 4.6 3.6"/>`,

  edit: (c) =>
    `<path ${S(c)} d="M4 20h4.2L20 8.2 15.8 4 4 15.8V20z"/><path ${S(c)} d="M13.2 6.2 17.8 10.8"/>`,

  trash: (c) =>
    `<path ${S(c)} d="M5 7.5h14"/><path ${S(c)} d="M9.2 7.5V6A1.5 1.5 0 0 1 10.7 4.5h2.6A1.5 1.5 0 0 1 14.8 6v1.5"/><path ${S(c)} d="M7.2 7.5l.9 11.2A1.6 1.6 0 0 0 9.7 20h4.6a1.6 1.6 0 0 0 1.6-1.3l.9-11.2"/><path ${S(c)} d="M10.2 11v5.5M13.8 11v5.5"/>`,

  info: (c) =>
    `<circle cx="12" cy="12" r="8" fill="none" stroke="${c}" stroke-width="2"/><path ${S(c)} d="M12 11v5.2M12 7.8h.01"/>`,
};

function buildSvg(name: IconName, color: string) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none">${PATHS[name](color)}</svg>`;
}

export function isIconName(value?: string): value is IconName {
  return !!value && Object.prototype.hasOwnProperty.call(PATHS, value);
}

function IconInner({ name, size = 20, color = '#333333', className = '' }: IconProps) {
  const src = useMemo(() => {
    const svg = buildSvg(name, color);
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  }, [name, color]);

  return (
    <View className={`tf-icon ${className}`.trim()} style={{ width: size, height: size }}>
      <Image className='tf-icon__img' src={src} mode='aspectFit' style={{ width: size, height: size }} />
    </View>
  );
}

export default memo(IconInner);
