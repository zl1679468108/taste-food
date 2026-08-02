/**
 * 骑手实时位置面板（仅配送中的外送订单展示）
 *
 * - 首次挂载拉取 GET /api/orders/:id/delivery-track 历史轨迹
 * - 订阅 socket delivery:track 事件做增量 append
 * - 使用腾讯 JavaScript API GL (TMap) 渲染交互式地图，Key 通过前端环境变量配置
 * - 点击地图可全屏查看，支持关闭
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Empty, Space, Spin, Tag, Tooltip, Typography } from 'antd';
import { EnvironmentOutlined, ReloadOutlined, FullscreenOutlined, FullscreenExitOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { getDeliveryTrack, DeliveryTrackPoint, Order } from '@/services/order';
import {
  connectSocket,
  disconnectSocket,
  offDeliveryTrackUpdated,
  onDeliveryTrackUpdated,
  DeliveryTrackEvent,
} from '@/services/socket';
import { brand } from '@/theme';
import './index.less';

const { Text } = Typography;

// UMI 会把 UMI_APP_* 注入到浏览器端 process.env
// 兼容历史 REACT_APP_* 命名，避免 import.meta.env（Vite 专属）导致崩溃
const TENCENT_MAP_KEY =
  process.env.UMI_APP_TENCENT_MAP_KEY ||
  process.env.REACT_APP_TENCENT_MAP_KEY ||
  '';
const HAS_FRONTEND_TENCENT_KEY = Boolean(TENCENT_MAP_KEY);

interface RiderLocationPanelProps {
  order: Order;
}

const SOURCE_LABELS: Record<string, string> = {
  rider: '骑手上报',
  rider_auto: '自动上报',
  rider_location: '无感定位',
  demo_location: '演示定位',
};

const MAX_TIMELINE_ROWS = 10;
const RELATIVE_TIME_REFRESH_MS = 10_000;

/** 标记点中文标签配置 */
const MARKER_LABELS = {
  shop: '商家',
  rider: '骑手',
  customer: '顾客',
} as const;

/** 标记点颜色 */
const MARKER_COLORS = {
  shop: '#2196f3',    // 蓝色 — 商家
  rider: '#ff6b35',   // 橙色 — 骑手
  customer: '#00c853', // 绿色 — 顾客
} as const;

interface GeoPoint {
  latitude: number;
  longitude: number;
}

// 腾讯地图 JavaScript API GL 运行时类型（外部脚本注入）
type TMapApi = any;
type TMapInstance = any;
type TMapMultiMarker = any;
type TMapPolyline = any;

declare global {
  interface Window {
    TMap?: TMapApi;
  }
}

interface MapInstance {
  map?: TMapInstance;
  markerLayer?: TMapMultiMarker;
  polyline?: TMapPolyline;
}

function getSourceLabel(source?: string): string {
  if (!source) return '未知来源';
  return SOURCE_LABELS[source] || source;
}

function formatCoord(value: number): string {
  return value.toFixed(6);
}

function formatRelative(time: string): string {
  const target = dayjs(time);
  if (!target.isValid()) return '-';
  const diffSeconds = dayjs().diff(target, 'second');
  if (diffSeconds < 0) return '刚刚';
  if (diffSeconds < 60) return `${diffSeconds} 秒前`;
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes} 分钟前`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} 小时前`;
  return target.format('YYYY-MM-DD HH:mm');
}

function isValidGeo(lat?: number, lng?: number): boolean {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng)
  );
}

function mergeTrackPoints(
  existing: DeliveryTrackPoint[],
  incoming: DeliveryTrackPoint[],
): DeliveryTrackPoint[] {
  const map = new Map<string, DeliveryTrackPoint>();
  [...existing, ...incoming].forEach((point) => {
    map.set(point.id, point);
  });
  return Array.from(map.values()).sort(
    (a, b) => dayjs(a.recordedAt).valueOf() - dayjs(b.recordedAt).valueOf(),
  );
}

/**
 * 创建中文标记图标（Canvas → DataURL）
 * 绘制圆角矩形背景 + 白色文字，适配「商家」「骑手」「顾客」等中文字符
 */
function createMarkerIconDataUrl(color: string, label: string): string {
  try {
    // 根据文字长度动态计算画布宽度
    const charCount = label.length;
    const paddingX = 12;
    const fontSize = 14;
    const approxCharWidth = fontSize; // 中文字符约等于字号宽度
    const width = Math.max(44, charCount * approxCharWidth + paddingX * 2);
    const height = 30;
    const radius = 6;

    const canvas = document.createElement('canvas');
    canvas.width = width * 2; // Retina 2x
    canvas.height = height * 2;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    ctx.scale(2, 2);

    // 圆角矩形背景
    ctx.beginPath();
    ctx.roundRect(0, 0, width, height, radius);
    ctx.fillStyle = color;
    ctx.fill();

    // 白色文字居中
    ctx.fillStyle = '#fff';
    ctx.font = `600 ${fontSize}px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, width / 2, height / 2 + 1);

    return canvas.toDataURL('image/png');
  } catch (e) {
    console.warn('Canvas marker icon failed:', e);
    return '';
  }
}

const RiderLocationPanel: React.FC<RiderLocationPanelProps> = ({ order }) => {
  const orderId = order.id;
  const [track, setTrack] = useState<DeliveryTrackPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [, setRelativeTick] = useState(0);
  const [liveDeliveryCount, setLiveDeliveryCount] = useState<number | undefined>(undefined);
  const [fullscreen, setFullscreen] = useState(false);
  const mountedRef = useRef(true);

  // 地图相关引用（内嵌面板）
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<MapInstance | null>(null);
  const scriptLoadedRef = React.useRef(false);

  // 全屏地图引用
  const fullscreenContainerRef = useRef<HTMLDivElement>(null);
  const fullscreenInstanceRef = useRef<MapInstance | null>(null);

  const shopPoint = useMemo<GeoPoint | undefined>(
    () =>
      isValidGeo(order.shopLatitude, order.shopLongitude)
        ? { latitude: order.shopLatitude as number, longitude: order.shopLongitude as number }
        : undefined,
    [order.shopLatitude, order.shopLongitude],
  );

  const customerPoint = useMemo<GeoPoint | undefined>(
    () =>
      isValidGeo(order.deliveryLatitude, order.deliveryLongitude)
        ? {
            latitude: order.deliveryLatitude as number,
            longitude: order.deliveryLongitude as number,
          }
        : undefined,
    [order.deliveryLatitude, order.deliveryLongitude],
  );

  const latest = track.length > 0 ? track[track.length - 1] : undefined;

  const focusPoint = useMemo<GeoPoint | undefined>(() => {
    if (latest) return { latitude: latest.latitude, longitude: latest.longitude };
    if (shopPoint && customerPoint) {
      return {
        latitude: (shopPoint.latitude + customerPoint.latitude) / 2,
        longitude: (shopPoint.longitude + customerPoint.longitude) / 2,
      };
    }
    return shopPoint || customerPoint;
  }, [latest, shopPoint, customerPoint]);

  const fetchTrack = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getDeliveryTrack(orderId);
      if (!mountedRef.current) return;
      setTrack(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('加载配送轨迹失败:', e);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [orderId]);

  // 首次挂载时加载轨迹
  useEffect(() => {
    mountedRef.current = true;
    setTrack([]);
    setLiveDeliveryCount(undefined);
    fetchTrack();
    return () => {
      mountedRef.current = false;
    };
  }, [fetchTrack]);

  // 初始化腾讯 JavaScript API GL
  const initTencentMap = useCallback(async (): Promise<void> => {
    if (scriptLoadedRef.current) return;

    return new Promise((resolve, reject) => {
      const key = TENCENT_MAP_KEY;
      if (!key) {
        console.error('未找到 UMI_APP_TENCENT_MAP_KEY（或 REACT_APP_TENCENT_MAP_KEY）');
        reject(new Error('TENCENT_MAP_KEY not configured'));
        return;
      }

      // 检查是否已经全局加载
      if ((window as any).TMap) {
        scriptLoadedRef.current = true;
        resolve();
        return;
      }

      // 创建 script 标签加载腾讯地图 JavaScript API GL
      const script = document.createElement('script');
      script.src = `https://map.qq.com/api/gljs?v=1.exp&key=${key}`;
      script.async = true;
      script.onload = () => {
        setTimeout(() => {
          if ((window as any).TMap) {
            scriptLoadedRef.current = true;
            resolve();
          } else {
            reject(new Error('Tencent Maps GL SDK loaded but TMap not available'));
          }
        }, 100);
      };
      script.onerror = (err) => {
        reject(new Error(`Failed to load Tencent Maps GL SDK: ${err}`));
      };

      document.head.appendChild(script);
    });
  }, []);

  /**
   * 将标记点和路径渲染到指定地图实例上
   */
  const renderToMap = useCallback((
    instanceRef: React.MutableRefObject<MapInstance | null>,
    containerEl: HTMLDivElement | null,
    isFullscreen?: boolean,
  ) => {
    if (!(window as any).TMap || !containerEl) return;

    const TMap = (window as any).TMap;
    const center = new TMap.LatLng(focusPoint?.latitude || 0, focusPoint?.longitude || 0);

    // 清除旧实例
    if (instanceRef.current?.map) {
      if (instanceRef.current.markerLayer) {
        instanceRef.current.markerLayer.setMap(null);
      }
      if (instanceRef.current.polyline) {
        instanceRef.current.polyline.setMap(null);
      }
      // 销毁旧地图实例
      instanceRef.current.map.destroy();
      instanceRef.current = { map: undefined, markerLayer: undefined, polyline: undefined };
    }

    // 创建新地图实例
    // isFullscreen: 内嵌面板地图禁用所有交互（拖拽/缩放/控件），仅全屏允许操作
    const map = new TMap.Map(containerEl, {
      center,
      zoom: Math.min(15, track.length > 1 ? 12 : 15),
      scrollable: isFullscreen ?? false,
      draggable: isFullscreen ?? false,
      showControl: isFullscreen ?? false,
    });

    instanceRef.current = { map };

    // 构建标记点数据
    const geometries: any[] = [];
    let geoId = 0;

    if (shopPoint) {
      geometries.push({
        id: `shop-${geoId++}`,
        styleId: 'shop',
        position: new TMap.LatLng(shopPoint.latitude, shopPoint.longitude),
      });
    }

    if (customerPoint) {
      geometries.push({
        id: `customer-${geoId++}`,
        styleId: 'customer',
        position: new TMap.LatLng(customerPoint.latitude, customerPoint.longitude),
      });
    }

    if (latest) {
      geometries.push({
        id: `rider-${geoId++}`,
        styleId: 'rider',
        position: new TMap.LatLng(latest.latitude, latest.longitude),
      });
    }

    // 创建样式定义（中文标签）
    const styles: Record<string, any> = {};

    if (shopPoint) {
      styles.shop = new TMap.MarkerStyle({
        width: 68,
        height: 30,
        anchor: { x: 34, y: 15 },
        src: createMarkerIconDataUrl(MARKER_COLORS.shop, MARKER_LABELS.shop),
      });
    }

    if (customerPoint) {
      styles.customer = new TMap.MarkerStyle({
        width: 68,
        height: 30,
        anchor: { x: 34, y: 15 },
        src: createMarkerIconDataUrl(MARKER_COLORS.customer, MARKER_LABELS.customer),
      });
    }

    if (latest) {
      styles.rider = new TMap.MarkerStyle({
        width: 68,
        height: 30,
        anchor: { x: 34, y: 15 },
        src: createMarkerIconDataUrl(MARKER_COLORS.rider, MARKER_LABELS.rider),
      });
    }

    // 创建 MultiMarker 图层
    if (geometries.length > 0) {
      instanceRef.current.markerLayer = new TMap.MultiMarker({
        id: 'rider-marker-layer',
        map,
        styles,
        geometries,
      });
    }

    // 绘制轨迹路径
    if (track.length >= 2) {
      const pathCoords = track.map((p) => new TMap.LatLng(p.latitude, p.longitude));
      instanceRef.current.polyline = new TMap.Polyline({
        id: 'rider-polyline',
        map,
        path: pathCoords,
        strokeColor: '#FF8F65',
        strokeWidth: 4,
        strokeOpacity: 0.8,
      });

      // 调整视野包含所有标记点
      const bounds = new TMap.LatLngBounds();
      track.forEach((p) => {
        bounds.extend(new TMap.LatLng(p.latitude, p.longitude));
      });
      if (shopPoint) bounds.extend(new TMap.LatLng(shopPoint.latitude, shopPoint.longitude));
      if (customerPoint) bounds.extend(new TMap.LatLng(customerPoint.latitude, customerPoint.longitude));

      map.fitBounds(bounds, { padding: 50 });
    }
  }, [shopPoint, customerPoint, latest, track, focusPoint]);

  // 内嵌面板：初始化 + 渲染地图
  useEffect(() => {
    if (!HAS_FRONTEND_TENCENT_KEY) return;

    const timer = setTimeout(async () => {
      try {
        await initTencentMap();
        if (mapContainerRef.current && !fullscreen) {
          renderToMap(mapInstanceRef, mapContainerRef.current, false);
        }
      } catch (e) {
        console.error('Failed to initialize Tencent Maps:', e);
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [initTencentMap, HAS_FRONTEND_TENCENT_KEY, renderToMap, fullscreen]);

  // 全屏：打开时创建独立地图实例
  useEffect(() => {
    if (!fullscreen || !HAS_FRONTEND_TENCENT_KEY) {
      // 关闭全屏时销毁全屏地图
      if (fullscreenInstanceRef.current?.map) {
        if (fullscreenInstanceRef.current.markerLayer) {
          fullscreenInstanceRef.current.markerLayer.setMap(null);
        }
        if (fullscreenInstanceRef.current.polyline) {
          fullscreenInstanceRef.current.polyline.setMap(null);
        }
        fullscreenInstanceRef.current.map.destroy();
        fullscreenInstanceRef.current = { map: undefined, markerLayer: undefined, polyline: undefined };
      }
      return;
    }

    // 延迟等待 DOM 渲染
    const timer = setTimeout(async () => {
      try {
        await initTencentMap();
        if (fullscreenContainerRef.current) {
          renderToMap(fullscreenInstanceRef, fullscreenContainerRef.current, true);
        }
      } catch (e) {
        console.error('Failed to initialize fullscreen map:', e);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [fullscreen, initTencentMap, HAS_FRONTEND_TENCENT_KEY, renderToMap]);

  // 效应：WebSocket 实时轨迹更新
  useEffect(() => {
    connectSocket();
    const handleTrack = (data: DeliveryTrackEvent) => {
      if (!mountedRef.current || data.orderId !== orderId) return;
      if (typeof data.riderDeliveryCount === 'number') {
        setLiveDeliveryCount(data.riderDeliveryCount);
      }
      setTrack((prev) =>
        mergeTrackPoints(prev, [
          {
            id: `ws-${data.orderId}-${data.recordedAt}`,
            orderId: data.orderId,
            shopId: data.shopId,
            riderId: data.riderId,
            latitude: data.latitude,
            longitude: data.longitude,
            source: 'rider_auto',
            recordedAt: data.recordedAt,
            createdAt: data.recordedAt,
          },
        ]),
      );
    };

    onDeliveryTrackUpdated(handleTrack);
    return () => {
      offDeliveryTrackUpdated(handleTrack);
      disconnectSocket();
    };
  }, [orderId]);

  // 效应：相对时间刷新
  useEffect(() => {
    const timer = window.setInterval(() => {
      setRelativeTick((value) => value + 1);
    }, RELATIVE_TIME_REFRESH_MS);
    return () => {
      window.clearInterval(timer);
    };
  }, []);

  const timelineRows = useMemo(
    () => [...track].reverse().slice(0, MAX_TIMELINE_ROWS),
    [track],
  );

  const deliveryCount = liveDeliveryCount ?? order.riderDeliveryCount;

  const handleRefresh = async () => {
    await fetchTrack();
  };

  /** 切换全屏 */
  const toggleFullscreen = useCallback(() => {
    setFullscreen((prev) => !prev);
  }, []);

  /** 关闭全屏 */
  const closeFullscreen = useCallback(() => {
    setFullscreen(false);
  }, []);

  return (
    <>
      <div className="tf-rider-panel">
        <div className="tf-rider-panel__header">
          <span className="tf-rider-panel__title">
            <EnvironmentOutlined style={{ color: brand.primary }} />
            骑手实时位置
          </span>
          <Space size={4}>
            <Tooltip title="重新拉取轨迹与地图">
              <Button
                size="small"
                icon={<ReloadOutlined />}
                onClick={handleRefresh}
                loading={loading}
              >
                刷新
              </Button>
            </Tooltip>
            {HAS_FRONTEND_TENCENT_KEY && focusPoint ? (
              <Tooltip title={fullscreen ? '退出全屏' : '全屏查看地图'}>
                <Button
                  size="small"
                  icon={fullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
                  onClick={toggleFullscreen}
                >
                  {fullscreen ? '退出全屏' : '全屏'}
                </Button>
              </Tooltip>
            ) : null}
          </Space>
        </div>

        <Spin spinning={loading}>
          {focusPoint ? (
            <>
              <div className="tf-rider-panel__meta">
                <div className="tf-rider-panel__meta-item">
                  <span className="tf-rider-panel__meta-label">最新坐标</span>
                  <span className="tf-rider-panel__meta-value tf-rider-panel__coord">
                    {latest
                      ? `${formatCoord(latest.latitude)}, ${formatCoord(latest.longitude)}`
                      : `${formatCoord(focusPoint.latitude)}, ${formatCoord(focusPoint.longitude)}`}
                  </span>
                </div>
                <div className="tf-rider-panel__meta-item">
                  <span className="tf-rider-panel__meta-label">最后更新时间</span>
                  <span className="tf-rider-panel__meta-value">
                    {latest ? (
                      <Tooltip title={dayjs(latest.recordedAt).format('YYYY-MM-DD HH:mm:ss')}>
                        {formatRelative(latest.recordedAt)}
                      </Tooltip>
                    ) : (
                      '待骑手上报'
                    )}
                  </span>
                </div>
                <div className="tf-rider-panel__meta-item">
                  <span className="tf-rider-panel__meta-label">上报来源</span>
                  <span className="tf-rider-panel__meta-value">
                    {latest ? (
                      <Tag color={brand.primary} style={{ marginInlineEnd: 0 }}>
                        {getSourceLabel(latest.source)}
                      </Tag>
                    ) : (
                      '-'
                    )}
                  </span>
                </div>
                <div className="tf-rider-panel__meta-item">
                  <span className="tf-rider-panel__meta-label">骑手同时配送</span>
                  <span className="tf-rider-panel__meta-value">
                    {typeof deliveryCount === 'number' ? `${deliveryCount} 单` : '-'}
                  </span>
                </div>
              </div>

              <div
                className="tf-rider-panel__map"
                onClick={HAS_FRONTEND_TENCENT_KEY ? toggleFullscreen : undefined}
                title={HAS_FRONTEND_TENCENT_KEY ? '点击全屏查看' : undefined}
                style={{ cursor: HAS_FRONTEND_TENCENT_KEY ? 'pointer' : 'default' }}
              >
                {HAS_FRONTEND_TENCENT_KEY ? (
                  <div
                    ref={mapContainerRef}
                    className="tf-rider-panel__map-container interactive"
                    style={{ height: '100%' }}
                  >
                    {!scriptLoadedRef.current && (
                      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: '#999' }}>
                        加载中腾讯地图...
                      </div>
                    )}
                  </div>
                ) : (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="未配置腾讯地图 Key" />
                )}

                {/* 小视口：只读覆盖层 — 拦截所有地图交互，点击触发全屏 */}
                {HAS_FRONTEND_TENCENT_KEY && (
                  <div className="tf-rider-panel__map-readonly">
                    <span className="tf-rider-panel__map-readonly-hint">
                      <FullscreenOutlined /> 点击全屏操作地图
                    </span>
                  </div>
                )}
              </div>

              {timelineRows.length > 0 ? (
                <div className="tf-rider-panel__timeline">
                  <div className="tf-rider-panel__timeline-title">
                    最近上报（共 {track.length} 个轨迹点，最多展示 {MAX_TIMELINE_ROWS} 条）
                  </div>
                  <div className="tf-rider-panel__timeline-list">
                    {timelineRows.map((point) => (
                      <div key={point.id} className="tf-rider-panel__timeline-row">
                        <span className="tf-rider-panel__timeline-time">
                          {dayjs(point.recordedAt).format('HH:mm:ss')}
                        </span>
                        <span className="tf-rider-panel__track-coord">
                          {formatCoord(point.latitude)}, {formatCoord(point.longitude)}
                        </span>
                        <span className="tf-rider-panel__timeline-source">
                          {getSourceLabel(point.source)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="tf-rider-panel__timeline-empty">
                  <Text type="secondary">骑手尚未上报位置，已展示店铺/收货参考点</Text>
                </div>
              )}
            </>
          ) : (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="暂无可用坐标。请确认店铺与收货地址已配置腾讯地图坐标，或等待骑手上报位置。"
            />
          )}
        </Spin>
      </div>

      {/* 全屏地图弹层 */}
      {fullscreen && (
        <div className="tf-rider-fullscreen" onClick={closeFullscreen}>
          <div
            className="tf-rider-fullscreen__inner"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="tf-rider-fullscreen__header">
              <span className="tf-rider-fullscreen__title">骑手实时位置 · 全屏</span>
              <Space size={8}>
                <Button size="small" icon={<ReloadOutlined />} onClick={(e) => { e.stopPropagation(); handleRefresh(); }}>
                  刷新
                </Button>
                <Button size="small" icon={<FullscreenExitOutlined />} onClick={closeFullscreen}>
                  关闭（ESC）
                </Button>
              </Space>
            </div>
            <div className="tf-rider-fullscreen__body">
              <div ref={fullscreenContainerRef} className="tf-rider-fullscreen__map" />
            </div>
            <div className="tf-rider-fullscreen__footer">
              <Space size={16}>
                <span><i className="tf-rider-fullscreen__dot tf-rider-fullscreen__dot--shop" /> 商家</span>
                <span><i className="tf-rider-fullscreen__dot tf-rider-fullscreen__dot--rider" /> 骑手</span>
                <span><i className="tf-rider-fullscreen__dot tf-rider-fullscreen__dot--customer" /> 顾客</span>
              </Space>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default RiderLocationPanel;
