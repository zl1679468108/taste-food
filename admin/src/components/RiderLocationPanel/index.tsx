/**
 * 骑手实时位置面板（仅配送中的外送订单展示）
 *
 * - 首次挂载拉取 GET /api/orders/:id/delivery-track 历史轨迹
 * - 订阅 socket delivery:track 事件做增量 append，不做全量重拉，避免请求风暴
 * - admin 无地图 SDK，采用等比归一化投影的 svg 示意图 + 外链跳转高德/腾讯地图
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Empty, Space, Spin, Tag, Tooltip, Typography } from 'antd';
import { EnvironmentOutlined, ReloadOutlined } from '@ant-design/icons';
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

interface RiderLocationPanelProps {
  order: Order;
}

/** 轨迹点来源展示文案 */
const SOURCE_LABELS: Record<string, string> = {
  rider: '骑手上报',
  rider_auto: '自动上报',
  rider_location: '无感定位',
  demo_location: '演示定位',
};

/** 时间轴最多展示条数 */
const MAX_TIMELINE_ROWS = 10;
/** 相对时间刷新间隔 */
const RELATIVE_TIME_REFRESH_MS = 10_000;

/** svg 视图尺寸与内边距（保证端点圆形与文案不被裁切） */
const VIEW_WIDTH = 640;
const VIEW_HEIGHT = 260;
const VIEW_PADDING = 36;

interface ViewPoint {
  x: number;
  y: number;
}

interface GeoPoint {
  latitude: number;
  longitude: number;
}

function getSourceLabel(source?: string): string {
  if (!source) return '未知来源';
  return SOURCE_LABELS[source] || source;
}

function formatCoord(value: number): string {
  return value.toFixed(6);
}

/** dayjs 相对时间（避免额外引入 relativeTime 插件的 locale 依赖） */
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

/**
 * 等比归一化投影：把经纬度映射到 svg 视图坐标。
 * 退化处理：单点或所有点经纬度相同时跨度为 0，统一落到视图中心（除零保护）。
 */
function createProjector(points: GeoPoint[]): (point: GeoPoint) => ViewPoint {
  const lats = points.map((item) => item.latitude);
  const lngs = points.map((item) => item.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const spanLat = maxLat - minLat;
  const spanLng = maxLng - minLng;
  const innerWidth = VIEW_WIDTH - VIEW_PADDING * 2;
  const innerHeight = VIEW_HEIGHT - VIEW_PADDING * 2;

  return (point: GeoPoint): ViewPoint => {
    // 跨度为 0 时取 0.5，避免除零产生 NaN
    const ratioX = spanLng === 0 ? 0.5 : (point.longitude - minLng) / spanLng;
    // 纬度向北为上，需翻转 y 轴
    const ratioY = spanLat === 0 ? 0.5 : 1 - (point.latitude - minLat) / spanLat;
    return {
      x: VIEW_PADDING + ratioX * innerWidth,
      y: VIEW_PADDING + ratioY * innerHeight,
    };
  };
}

/** 去重合并轨迹点：同一 id 覆盖，其余按 recordedAt 升序 */
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

const RiderLocationPanel: React.FC<RiderLocationPanelProps> = ({ order }) => {
  const orderId = order.id;
  const [track, setTrack] = useState<DeliveryTrackPoint[]>([]);
  const [loading, setLoading] = useState(false);
  /** 仅用于驱动相对时间重新渲染 */
  const [, setRelativeTick] = useState(0);
  /** 实时推送带来的骑手同时配送单数（优先于订单快照） */
  const [liveDeliveryCount, setLiveDeliveryCount] = useState<number | undefined>(undefined);
  /** 避免卸载后 setState */
  const mountedRef = useRef(true);

  const fetchTrack = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getDeliveryTrack(orderId);
      if (!mountedRef.current) return;
      setTrack(Array.isArray(data) ? data : []);
    } catch (e) {
      // 静默降级：面板展示空状态即可，不打扰订单详情主流程
      console.error('加载配送轨迹失败:', e);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    mountedRef.current = true;
    setTrack([]);
    setLiveDeliveryCount(undefined);
    fetchTrack();
    return () => {
      mountedRef.current = false;
    };
  }, [fetchTrack]);

  // 订阅实时推送：增量 append，不重复全量拉取
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
            // 推送 payload 无轨迹点 id，用 orderId + 时间戳兜底去重
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

  // 相对时间自动刷新
  useEffect(() => {
    const timer = window.setInterval(() => {
      setRelativeTick((value) => value + 1);
    }, RELATIVE_TIME_REFRESH_MS);
    return () => {
      window.clearInterval(timer);
    };
  }, []);

  const latest = track.length > 0 ? track[track.length - 1] : undefined;

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

  /** 示意图几何：轨迹折线 + 店铺/骑手/顾客三点 */
  const chart = useMemo(() => {
    if (track.length === 0) return undefined;
    const geoPoints: GeoPoint[] = [
      ...(shopPoint ? [shopPoint] : []),
      ...track.map((point) => ({ latitude: point.latitude, longitude: point.longitude })),
      ...(customerPoint ? [customerPoint] : []),
    ];

    const project = createProjector(geoPoints);
    const trackView = track.map((point) =>
      project({ latitude: point.latitude, longitude: point.longitude }),
    );
    return {
      shop: shopPoint ? project(shopPoint) : undefined,
      customer: customerPoint ? project(customerPoint) : undefined,
      rider: trackView[trackView.length - 1],
      // 点数 < 2 时无折线可画，仅渲染骑手点
      polyline:
        trackView.length >= 2
          ? trackView.map((view) => `${view.x.toFixed(1)},${view.y.toFixed(1)}`).join(' ')
          : '',
      trackView,
    };
  }, [track, shopPoint, customerPoint]);

  const timelineRows = useMemo(
    () => [...track].reverse().slice(0, MAX_TIMELINE_ROWS),
    [track],
  );

  const deliveryCount = liveDeliveryCount ?? order.riderDeliveryCount;

  const amapUrl = latest
    ? `https://uri.amap.com/marker?position=${latest.longitude},${latest.latitude}&name=${encodeURIComponent('骑手当前位置')}&coordinate=gaode`
    : '';
  const tencentUrl = latest
    ? `https://apis.map.qq.com/uri/v1/marker?marker=coord:${latest.latitude},${latest.longitude};title:${encodeURIComponent('骑手当前位置')}&referer=taste-food-admin`
    : '';

  return (
    <div className="tf-rider-panel">
      <div className="tf-rider-panel__header">
        <span className="tf-rider-panel__title">
          <EnvironmentOutlined style={{ color: brand.primary }} />
          骑手实时位置
        </span>
        <Space size={4}>
          <Tooltip title="重新拉取完整轨迹">
            <Button size="small" icon={<ReloadOutlined />} onClick={fetchTrack} loading={loading}>
              刷新
            </Button>
          </Tooltip>
          {latest ? (
            <>
              <Button size="small" href={amapUrl} target="_blank" rel="noreferrer">
                高德地图打开
              </Button>
              <Button size="small" href={tencentUrl} target="_blank" rel="noreferrer">
                腾讯地图打开
              </Button>
            </>
          ) : null}
        </Space>
      </div>

      <Spin spinning={loading}>
        {latest && chart ? (
          <>
            <div className="tf-rider-panel__meta">
              <div className="tf-rider-panel__meta-item">
                <span className="tf-rider-panel__meta-label">最新坐标</span>
                <span className="tf-rider-panel__meta-value tf-rider-panel__coord">
                  {formatCoord(latest.latitude)}, {formatCoord(latest.longitude)}
                </span>
              </div>
              <div className="tf-rider-panel__meta-item">
                <span className="tf-rider-panel__meta-label">最后更新时间</span>
                <span className="tf-rider-panel__meta-value">
                  <Tooltip title={dayjs(latest.recordedAt).format('YYYY-MM-DD HH:mm:ss')}>
                    {formatRelative(latest.recordedAt)}
                  </Tooltip>
                </span>
              </div>
              <div className="tf-rider-panel__meta-item">
                <span className="tf-rider-panel__meta-label">上报来源</span>
                <span className="tf-rider-panel__meta-value">
                  <Tag color={brand.primary} style={{ marginInlineEnd: 0 }}>
                    {getSourceLabel(latest.source)}
                  </Tag>
                </span>
              </div>
              <div className="tf-rider-panel__meta-item">
                <span className="tf-rider-panel__meta-label">骑手同时配送</span>
                <span className="tf-rider-panel__meta-value">
                  {typeof deliveryCount === 'number' ? `${deliveryCount} 单` : '-'}
                </span>
              </div>
            </div>

            <div className="tf-rider-panel__chart">
              <svg
                className="tf-rider-panel__svg"
                viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
                role="img"
                aria-label="骑手配送轨迹示意图"
              >
                {/* 店铺 → 顾客 参考直线 */}
                {chart.shop && chart.customer ? (
                  <line
                    x1={chart.shop.x}
                    y1={chart.shop.y}
                    x2={chart.customer.x}
                    y2={chart.customer.y}
                    stroke={brand.gray300}
                    strokeWidth={1}
                    strokeDasharray="6 6"
                  />
                ) : null}

                {/* 骑手历史轨迹折线 */}
                {chart.polyline ? (
                  <polyline
                    points={chart.polyline}
                    fill="none"
                    stroke={brand.primaryEnd}
                    strokeWidth={2}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                ) : null}

                {/* 历史轨迹点（不含最新点，最新点单独高亮） */}
                {chart.trackView.slice(0, -1).map((view, index) => (
                  <circle
                    key={track[index]?.id ?? `track-${index}`}
                    cx={view.x}
                    cy={view.y}
                    r={2.5}
                    fill={brand.primaryLight}
                    stroke={brand.primaryEnd}
                    strokeWidth={1}
                  />
                ))}

                {chart.shop ? (
                  <>
                    <circle cx={chart.shop.x} cy={chart.shop.y} r={6} fill={brand.info} />
                    <text
                      x={chart.shop.x}
                      y={chart.shop.y - 12}
                      textAnchor="middle"
                      fontSize={12}
                      fill={brand.textSecondary}
                    >
                      店铺
                    </text>
                  </>
                ) : null}

                {chart.customer ? (
                  <>
                    <circle
                      cx={chart.customer.x}
                      cy={chart.customer.y}
                      r={6}
                      fill={brand.success}
                    />
                    <text
                      x={chart.customer.x}
                      y={chart.customer.y - 12}
                      textAnchor="middle"
                      fontSize={12}
                      fill={brand.textSecondary}
                    >
                      顾客
                    </text>
                  </>
                ) : null}

                {/* 骑手当前位置：主色高亮 + 呼吸动画 */}
                <circle
                  className="tf-rider-panel__rider-dot"
                  cx={chart.rider.x}
                  cy={chart.rider.y}
                  r={7}
                  fill={brand.primary}
                />
                <circle cx={chart.rider.x} cy={chart.rider.y} r={7} fill={brand.primary} />
                <circle cx={chart.rider.x} cy={chart.rider.y} r={3} fill={brand.white} />
                <text
                  x={chart.rider.x}
                  y={chart.rider.y + 22}
                  textAnchor="middle"
                  fontSize={12}
                  fill={brand.primary}
                >
                  骑手
                </text>
              </svg>

              <div className="tf-rider-panel__legend">
                <span className="tf-rider-panel__legend-item">
                  <i className="tf-rider-panel__legend-dot" style={{ background: brand.info }} />
                  店铺
                </span>
                <span className="tf-rider-panel__legend-item">
                  <i className="tf-rider-panel__legend-dot" style={{ background: brand.primary }} />
                  骑手当前位置
                </span>
                <span className="tf-rider-panel__legend-item">
                  <i className="tf-rider-panel__legend-dot" style={{ background: brand.success }} />
                  顾客
                </span>
                <Text type="secondary" style={{ fontSize: brand.font2xs }}>
                  示意图按经纬度等比投影，非真实路网
                </Text>
              </div>
            </div>

            <div className="tf-rider-panel__track">
              <div className="tf-rider-panel__track-title">
                最近上报（共 {track.length} 个轨迹点，最多展示 {MAX_TIMELINE_ROWS} 条）
              </div>
              <div className="tf-rider-panel__track-list">
                {timelineRows.map((point, index) => (
                  <div
                    key={point.id}
                    className={
                      index === 0
                        ? 'tf-rider-panel__track-row tf-rider-panel__track-row--latest'
                        : 'tf-rider-panel__track-row'
                    }
                  >
                    <span>{dayjs(point.recordedAt).format('HH:mm:ss')}</span>
                    <span className="tf-rider-panel__track-coord">
                      {formatCoord(point.latitude)}, {formatCoord(point.longitude)}
                    </span>
                    <span>{getSourceLabel(point.source)}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={loading ? '正在加载骑手位置…' : '骑手尚未上报位置'}
          />
        )}
      </Spin>
    </div>
  );
};

export default RiderLocationPanel;
