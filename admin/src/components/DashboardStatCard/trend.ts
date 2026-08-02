/**
 * Dashboard 环比趋势计算。
 *
 * 颜色规范（中国习惯）：上涨=红、下跌=绿，由消费方按 direction 取 brand.danger / brand.success。
 */
export type TrendDirection = 'up' | 'down' | 'flat' | 'none';

export interface TrendResult {
  direction: TrendDirection;
  /** 展示文案：'+12.5%' / '-3.2%' / '持平' / '新增' / '—' */
  text: string;
  /** 是否有可比的基期数据 */
  comparable: boolean;
}

/**
 * 计算环比变化。
 * 边界处理：
 * - 基期为 0 且本期为 0 → '—'（无数据可比）
 * - 基期为 0 且本期 > 0 → '新增'（避免 Infinity%）
 * - 非有限数值统一按 0 处理，避免 NaN
 */
export function calcTrend(current: number, previous: number): TrendResult {
  const cur = Number.isFinite(current) ? current : 0;
  const prev = Number.isFinite(previous) ? previous : 0;

  if (prev === 0) {
    return cur === 0
      ? { direction: 'none', text: '—', comparable: false }
      : { direction: 'up', text: '新增', comparable: false };
  }

  const pct = ((cur - prev) / Math.abs(prev)) * 100;
  if (!Number.isFinite(pct) || Math.abs(pct) < 0.05) {
    return { direction: 'flat', text: '持平', comparable: true };
  }

  return {
    direction: pct > 0 ? 'up' : 'down',
    text: `${pct > 0 ? '+' : '-'}${Math.abs(pct).toFixed(1)}%`,
    comparable: true,
  };
}
