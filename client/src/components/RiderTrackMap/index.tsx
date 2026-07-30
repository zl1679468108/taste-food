import { useEffect, useMemo, useState } from 'react';
import { View, Text, Map as TaroMap } from '@tarojs/components';
import { DeliveryTrackPoint } from '../../types/order';
import Icon from '../Icon';
import orderActiveIcon from '../../assets/icons/order-active.png';
import './index.scss';

/** 地图坐标点（GCJ-02，腾讯地图） */
export interface MapPoint {
  latitude: number;
  longitude: number;
}

export interface RiderTrackMapProps {
  /** 配送轨迹点，按 recordedAt 升序；最后一项视为骑手当前位置 */
  track: DeliveryTrackPoint[];
  /** 店铺坐标 */
  shopPoint?: MapPoint | null;
  /** 收货地址坐标 */
  customerPoint?: MapPoint | null;
  /** 骑手手上同时配送的单数 */
  riderDeliveryCount?: number;
  /** 轨迹加载中 */
  loading?: boolean;
  /** 区块标题 */
  title?: string;
  /** 是否展示骑手信息面板（最后上报时间 + 同时配送单数） */
  showRiderPanel?: boolean;
  /** true 时仅在骑手已上报位置后渲染地图，避免展示只有起终点的空地图 */
  requireTrack?: boolean;
  /** 无坐标时的提示文案 */
  emptyText?: string;
  /** 骑手尚未上报位置时的提示文案（仍有店铺/顾客坐标时展示在状态位） */
  pendingText?: string;
  /** 外层附加 class */
  className?: string;
}

/** native map 颜色需要传十六进制字面量，此处与 design-tokens 保持同值 */
const COLOR_PRIMARY = '#FF6B35'; // $primary
const COLOR_SUCCESS = '#00C853'; // $success
const COLOR_INFO = '#2196F3'; // $info
const COLOR_WHITE = '#FFFFFF'; // $white
const COLOR_ICON = '#333333';

/** 相对时间刷新间隔 */
const AGE_TICK_MS = 10000;

type MapCallout = {
  content: string;
  color: string;
  fontSize: number;
  borderRadius: number;
  borderWidth: number;
  borderColor: string;
  bgColor: string;
  padding: number;
  display: 'ALWAYS';
  textAlign: 'center';
  anchorX: number;
  anchorY: number;
};

type MapMarker = {
  id: number;
  latitude: number;
  longitude: number;
  iconPath: string;
  width: number;
  height: number;
  callout: MapCallout;
};

type MapPolyline = {
  points: MapPoint[];
  color: string;
  width: number;
  dottedLine: boolean;
};

/** 无坐标时的兜底地图中心，仅用于居中，不做标注 */
const FALLBACK_CENTER: MapPoint = { latitude: 28.682, longitude: 115.8579 };

/** 构建常显气泡 */
function buildCallout(content: string, bgColor: string): MapCallout {
  return {
    content,
    color: COLOR_WHITE,
    fontSize: 11,
    borderRadius: 10,
    borderWidth: 0,
    borderColor: bgColor,
    bgColor,
    padding: 4,
    display: 'ALWAYS',
    textAlign: 'center',
    anchorX: 0,
    anchorY: 0,
  };
}

/**
 * 坐标数值 → MapPoint，任一维度缺失返回 null。
 * 供页面把 order.shopLatitude / deliveryLatitude 等转成组件入参。
 */
export function toMapPoint(latitude?: number, longitude?: number): MapPoint | null {
  return typeof latitude === 'number' && typeof longitude === 'number'
    ? { latitude, longitude }
    : null;
}

/** 骑手最后上报距今的相对时间（秒级） */
export function formatTrackAge(recordedAt: string, now: number = Date.now()): string {
  const recorded = new Date(recordedAt).getTime();
  if (Number.isNaN(recorded)) return '';

  const diffSeconds = Math.max(0, Math.floor((now - recorded) / 1000));
  if (diffSeconds < 10) return '刚刚';
  if (diffSeconds < 60) return `${Math.floor(diffSeconds / 10) * 10}秒前`;

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}分钟前`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}小时前`;

  return `${Math.floor(diffHours / 24)}天前`;
}

/**
 * 骑手实时位置地图：店铺 → 骑手当前位置 → 顾客，轨迹 polyline + 常显气泡。
 * 顾客端订单详情与商家端订单详情共用。
 */
const RiderTrackMap = ({
  track,
  shopPoint = null,
  customerPoint = null,
  riderDeliveryCount,
  loading = false,
  title = '骑手实时位置',
  showRiderPanel = true,
  requireTrack = false,
  emptyText = '暂无可用坐标。请在地址簿地图选点，或为店铺配置腾讯地图坐标后重新下单。',
  pendingText = '骑手尚未上报位置',
  className = '',
}: RiderTrackMapProps) => {
  const [fullscreen, setFullscreen] = useState(false);
  const [nowTs, setNowTs] = useState(() => Date.now());

  const lastTrackPoint = track.length > 0 ? track[track.length - 1] : undefined;

  // 相对时间定时刷新：仅在有上报点时启动，卸载/无点时清理
  useEffect(() => {
    if (!lastTrackPoint) return;

    setNowTs(Date.now());
    const timer = setInterval(() => setNowTs(Date.now()), AGE_TICK_MS);
    return () => clearInterval(timer);
  }, [lastTrackPoint?.recordedAt]);

  const hasMapPoints = requireTrack
    ? !!lastTrackPoint
    : !!(shopPoint || customerPoint || lastTrackPoint);

  const mapCenter: MapPoint = lastTrackPoint
    ? { latitude: lastTrackPoint.latitude, longitude: lastTrackPoint.longitude }
    : customerPoint || shopPoint || FALLBACK_CENTER;

  const routePoints = useMemo<MapPoint[]>(() => {
    const points: MapPoint[] = [];
    if (shopPoint) points.push(shopPoint);
    points.push(...track.map((p) => ({ latitude: p.latitude, longitude: p.longitude })));
    if (customerPoint) points.push(customerPoint);
    return points;
  }, [shopPoint, customerPoint, track]);

  const includePoints = useMemo<MapPoint[]>(() => {
    const seen = new Set<string>();
    const points: MapPoint[] = [];
    const push = (p?: MapPoint | null) => {
      if (!p) return;
      const key = `${p.latitude},${p.longitude}`;
      if (seen.has(key)) return;
      seen.add(key);
      points.push(p);
    };
    push(shopPoint);
    for (const p of routePoints) push(p);
    push(customerPoint);
    return points;
  }, [shopPoint, customerPoint, routePoints]);

  const polyline = useMemo<MapPolyline[]>(
    () =>
      routePoints.length >= 2
        ? [
            {
              points: routePoints,
              color: COLOR_PRIMARY,
              width: 5,
              // 无骑手轨迹时用虚线表示预估路线
              dottedLine: track.length === 0,
            },
          ]
        : [],
    [routePoints, track.length],
  );

  const markers = useMemo<MapMarker[]>(() => {
    const list: MapMarker[] = [];
    if (shopPoint) {
      list.push({
        id: 1,
        latitude: shopPoint.latitude,
        longitude: shopPoint.longitude,
        iconPath: orderActiveIcon,
        width: 28,
        height: 28,
        callout: buildCallout('商家', COLOR_PRIMARY),
      });
    }
    if (customerPoint) {
      list.push({
        id: 2,
        latitude: customerPoint.latitude,
        longitude: customerPoint.longitude,
        iconPath: orderActiveIcon,
        width: 28,
        height: 28,
        callout: buildCallout('送达', COLOR_SUCCESS),
      });
    }
    if (lastTrackPoint) {
      list.push({
        id: 3,
        latitude: lastTrackPoint.latitude,
        longitude: lastTrackPoint.longitude,
        iconPath: orderActiveIcon,
        width: 34,
        height: 34,
        callout: buildCallout('骑手', COLOR_INFO),
      });
    }
    return list;
  }, [shopPoint, customerPoint, lastTrackPoint]);

  const trackAge = lastTrackPoint ? formatTrackAge(lastTrackPoint.recordedAt, nowTs) : '';
  const statusText = loading ? '更新中' : lastTrackPoint ? `更新于 ${trackAge}` : pendingText;

  return (
    <View className={`rider-track-map ${className}`}>
      <View className='rider-track-map__header'>
        <Text className='rider-track-map__title'>{title}</Text>
        <View className='rider-track-map__header-right'>
          <Text className='rider-track-map__status'>{statusText}</Text>
          {hasMapPoints ? (
            <View className='rider-track-map__expand' onClick={() => setFullscreen(true)}>
              <Text className='rider-track-map__expand-text'>全屏</Text>
            </View>
          ) : null}
        </View>
      </View>

      {hasMapPoints ? (
        <View className='rider-track-map__map-wrap' onClick={() => setFullscreen(true)}>
          {/* 全屏时卸载预览 map，避免原生组件层级穿透遮罩 */}
          {fullscreen ? (
            <View className='rider-track-map__map rider-track-map__map--placeholder'>
              <Text className='rider-track-map__placeholder-text'>全屏查看中</Text>
            </View>
          ) : (
            <TaroMap
              className='rider-track-map__map'
              latitude={mapCenter.latitude}
              longitude={mapCenter.longitude}
              scale={14}
              markers={markers}
              polyline={polyline}
              includePoints={includePoints}
              showLocation={false}
              enableScroll={false}
              enableZoom={false}
              onTap={() => setFullscreen(true)}
              onError={() => {
                console.warn('骑手位置地图加载失败');
              }}
            />
          )}
        </View>
      ) : (
        <View className='rider-track-map__empty'>
          <Text className='rider-track-map__empty-text'>{pendingText}</Text>
          {emptyText ? (
            <Text className='rider-track-map__empty-hint'>{emptyText}</Text>
          ) : null}
        </View>
      )}

      {showRiderPanel ? (
        <View className='rider-track-map__rider-panel'>
          <View className='rider-track-map__rider-item'>
            <Text className='rider-track-map__rider-label'>最后上报</Text>
            <Text className='rider-track-map__rider-value'>{trackAge || '待上报'}</Text>
          </View>
          <View className='rider-track-map__rider-divider' />
          <View className='rider-track-map__rider-item'>
            <Text className='rider-track-map__rider-label'>手上待配送</Text>
            <Text className='rider-track-map__rider-value'>
              {typeof riderDeliveryCount === 'number' ? `${riderDeliveryCount} 单` : '统计中'}
            </Text>
          </View>
        </View>
      ) : null}

      <View className='rider-track-map__meta'>
        <View className='rider-track-map__meta-item'>
          <View className='rider-track-map__legend-dot rider-track-map__legend-dot--shop' />
          <Text className='rider-track-map__meta-text'>商家</Text>
        </View>
        <View className='rider-track-map__meta-line' />
        <View className='rider-track-map__meta-item'>
          <View className='rider-track-map__legend-dot rider-track-map__legend-dot--route' />
          <Text className='rider-track-map__meta-text'>
            {lastTrackPoint ? '骑手' : '预估路线'}
          </Text>
        </View>
        <View className='rider-track-map__meta-line' />
        <View className='rider-track-map__meta-item'>
          <View className='rider-track-map__legend-dot rider-track-map__legend-dot--dest' />
          <Text className='rider-track-map__meta-text'>送达</Text>
        </View>
      </View>

      {fullscreen && hasMapPoints ? (
        <View className='rider-track-map__fullscreen'>
          <View className='rider-track-map__fullscreen-header'>
            <View
              className='rider-track-map__fullscreen-close'
              onClick={() => setFullscreen(false)}
            >
              <Icon name='close' size={18} color={COLOR_ICON} />
              <Text className='rider-track-map__fullscreen-close-text'>关闭</Text>
            </View>
            <Text className='rider-track-map__fullscreen-title'>{title}</Text>
            <Text className='rider-track-map__fullscreen-status'>{statusText}</Text>
          </View>
          <TaroMap
            className='rider-track-map__fullscreen-map'
            latitude={mapCenter.latitude}
            longitude={mapCenter.longitude}
            scale={15}
            markers={markers}
            polyline={polyline}
            includePoints={includePoints}
            showLocation={false}
            enableScroll
            enableZoom
            onError={() => {
              console.warn('全屏骑手位置地图加载失败');
            }}
          />
        </View>
      ) : null}
    </View>
  );
};

export default RiderTrackMap;
