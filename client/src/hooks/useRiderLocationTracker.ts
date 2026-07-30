import { useCallback, useEffect, useRef, useState } from 'react';
import Taro, { useDidHide, useDidShow } from '@tarojs/taro';
import { post } from '../utils/request';

/** 两次上报的最小时间间隔（毫秒） */
const MIN_REPORT_INTERVAL = 10_000;
/** 位移超过该阈值（米）时允许提前上报，保证转弯/加速时轨迹不失真 */
const MIN_REPORT_DISTANCE = 30;
/** 静止兜底：即使没有位置变化，也按该周期上报一次，便于各端判断骑手在线 */
const HEARTBEAT_INTERVAL = 60_000;
/** onLocationChange 不可用时的轮询兜底周期 */
const POLL_INTERVAL = 15_000;

export type RiderTrackerStatus = 'idle' | 'tracking' | 'denied' | 'error';

interface Coordinate {
  latitude: number;
  longitude: number;
  speed?: number;
  accuracy?: number;
}

interface RiderLocationReportResult {
  reported: number;
  orderIds: string[];
  recordedAt: string;
  riderDeliveryCount: number;
}

export interface RiderLocationTrackerState {
  status: RiderTrackerStatus;
  /** 最近一次成功上报的时间戳，未上报过为 0 */
  lastReportedAt: number;
  /** 最近一次成功同步的订单数 */
  lastReportedCount: number;
  /** 手动重试授权/定位，用于用户拒绝授权后的兜底入口 */
  retry: () => void;
}

/** 两点间距离（米），球面近似即可满足骑手轨迹的节流判断 */
function distanceInMeters(a: Coordinate, b: Coordinate): number {
  const EARTH_RADIUS = 6_371_000;
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const midLat = toRad((a.latitude + b.latitude) / 2);
  const x = dLng * Math.cos(midLat);
  return Math.sqrt(dLat * dLat + x * x) * EARTH_RADIUS;
}

/**
 * 骑手实时无感定位。
 *
 * 有配送中订单且页面处于前台时自动开启，退到后台或订单清零后自动停止；
 * 位置通过 `POST /orders/rider/location` 一次同步到该骑手全部配送中订单。
 *
 * 注意：小程序个人主体无法申请 `startLocationUpdateBackground`，
 * 因此仅能在小程序处于前台时持续定位，锁屏/切走后会停止更新。
 */
export function useRiderLocationTracker(enabled: boolean): RiderLocationTrackerState {
  const [status, setStatus] = useState<RiderTrackerStatus>('idle');
  const [lastReportedAt, setLastReportedAt] = useState(0);
  const [lastReportedCount, setLastReportedCount] = useState(0);

  // 以下均用 ref 保存，避免高频定位回调触发组件重渲染
  const listeningRef = useRef(false);
  const reportingRef = useRef(false);
  const lastSentRef = useRef<{ coord: Coordinate; at: number } | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const visibleRef = useRef(true);
  const enabledRef = useRef(enabled);
  const [retryToken, setRetryToken] = useState(0);

  const report = useCallback(async (coord: Coordinate, force = false) => {
    if (reportingRef.current) return;

    const now = Date.now();
    const last = lastSentRef.current;
    if (last && !force) {
      const elapsed = now - last.at;
      const moved = distanceInMeters(last.coord, coord);
      // 位移不足且未到心跳周期时跳过，控制请求量
      if (elapsed < MIN_REPORT_INTERVAL) return;
      if (moved < MIN_REPORT_DISTANCE && elapsed < HEARTBEAT_INTERVAL) return;
    }

    reportingRef.current = true;
    try {
      const res = await post<RiderLocationReportResult>(
        '/orders/rider/location',
        {
          latitude: coord.latitude,
          longitude: coord.longitude,
          speed: coord.speed && coord.speed > 0 ? coord.speed : undefined,
          accuracy: coord.accuracy && coord.accuracy > 0 ? coord.accuracy : undefined,
          source: 'rider_auto',
        },
        { showError: false },
      );
      lastSentRef.current = { coord, at: now };
      setLastReportedAt(now);
      setLastReportedCount(res.data?.reported ?? 0);
      setStatus('tracking');
    } catch (e) {
      // 弱网/切后台常见，静默重试即可，不打扰骑手
      console.error('骑手位置同步失败:', e);
      setStatus('error');
    } finally {
      reportingRef.current = false;
    }
  }, []);

  /** 单次取点兜底（onLocationChange 不可用或首点加速） */
  const reportOnce = useCallback(
    async (force = false) => {
      try {
        const res = await Taro.getLocation({ type: 'gcj02' });
        await report(
          {
            latitude: res.latitude,
            longitude: res.longitude,
            speed: res.speed,
            accuracy: res.accuracy,
          },
          force,
        );
      } catch (e) {
        console.error('获取骑手定位失败:', e);
        setStatus('denied');
      }
    },
    [report],
  );

  const stop = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    if (listeningRef.current) {
      listeningRef.current = false;
      try {
        Taro.offLocationChange();
        Taro.stopLocationUpdate();
      } catch (e) {
        console.error('停止骑手定位失败:', e);
      }
    }
  }, []);

  const start = useCallback(async () => {
    if (listeningRef.current) return;
    listeningRef.current = true;

    try {
      await Taro.startLocationUpdate();
      Taro.onLocationChange((res) => {
        if (!enabledRef.current || !visibleRef.current) return;
        void report({
          latitude: res.latitude,
          longitude: res.longitude,
          speed: res.speed,
          accuracy: res.accuracy,
        });
      });
      setStatus('tracking');
      // 首点立即上报，避免用户端等待一个节流周期才看到骑手
      void reportOnce(true);
    } catch (e) {
      // 未授权或基础库不支持：退化为定时轮询 getLocation
      console.error('开启实时定位失败，降级轮询:', e);
      listeningRef.current = false;
      void reportOnce(true);
      if (!pollTimerRef.current) {
        pollTimerRef.current = setInterval(() => {
          if (!enabledRef.current || !visibleRef.current) return;
          void reportOnce();
        }, POLL_INTERVAL);
      }
    }
  }, [report, reportOnce]);

  const retry = useCallback(() => {
    setStatus('idle');
    lastSentRef.current = null;
    setRetryToken((token) => token + 1);
  }, []);

  useDidShow(() => {
    visibleRef.current = true;
    if (enabledRef.current) {
      // 回到前台立即补一个点，弥补后台期间的轨迹空档
      void reportOnce(true);
    }
  });

  useDidHide(() => {
    visibleRef.current = false;
  });

  useEffect(() => {
    enabledRef.current = enabled;
    if (enabled) {
      void start();
    } else {
      stop();
      setStatus('idle');
      lastSentRef.current = null;
    }
    return () => {
      stop();
    };
    // retryToken 自增用于在用户手动重试后重新走一遍授权/开启流程
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, retryToken]);

  return { status, lastReportedAt, lastReportedCount, retry };
}
