import React, { useState } from 'react';
import { DatePicker, Segmented, Space, Tag, Typography } from 'antd';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import { brand } from '@/theme';

const { RangePicker } = DatePicker;

/** 自定义区间最大跨度（天，含首尾） */
export const MAX_RANGE_DAYS = 90;

export type PresetRange = '1' | '7' | '30';

export const PRESET_OPTIONS = [
  { label: '今日', value: '1' },
  { label: '近7天', value: '7' },
  { label: '近30天', value: '30' },
];

/** 统计口径：当前店铺 / 全店汇总（由顶栏店铺选择器统一控制，本组件只读取展示） */
export type StatsScope = 'shop' | 'all';

export interface DashboardRangeControlProps {
  preset: PresetRange;
  onPresetChange: (preset: PresetRange) => void;
  /** 自定义区间，非空时 Segmented 取消高亮 */
  customRange: [Dayjs, Dayjs] | null;
  onCustomRangeChange: (range: [Dayjs, Dayjs] | null) => void;
  /** 当前是否为全店视角，用于提示覆盖门店数（由顶栏 scope 驱动） */
  isAllShops?: boolean;
  /** 全店汇总覆盖的店铺数量，用于提示 */
  shopCount?: number;
  disabled?: boolean;
}

const DashboardRangeControl: React.FC<DashboardRangeControlProps> = ({
  preset,
  onPresetChange,
  customRange,
  onCustomRangeChange,
  isAllShops,
  shopCount,
  disabled = false,
}) => {
  // 记录日历选择过程中的半选状态，用于动态限制最大跨度
  const [picking, setPicking] = useState<[Dayjs | null, Dayjs | null] | null>(null);
  const isCustom = !!customRange;

  const disabledDate = (current: Dayjs): boolean => {
    if (!current) return false;
    // 禁止未来日期
    if (current.isAfter(dayjs().endOf('day'))) return true;
    const from = picking?.[0];
    const to = picking?.[1];
    // 已选起点未选终点：限制终点在 MAX_RANGE_DAYS 内
    if (from && !to) return Math.abs(current.diff(from, 'day')) >= MAX_RANGE_DAYS;
    if (!from && to) return Math.abs(to.diff(current, 'day')) >= MAX_RANGE_DAYS;
    return false;
  };

  return (
    <Space direction="vertical" size={8} style={{ width: '100%' }}>
      <Space size={12} wrap align="center">
        <Segmented
          options={PRESET_OPTIONS}
          // 自定义区间生效时传入不存在的值，使 Segmented 全部取消高亮（两者互斥）
          value={isCustom ? '' : preset}
          disabled={disabled}
          onChange={(v) => {
            onCustomRangeChange(null);
            setPicking(null);
            onPresetChange(String(v) as PresetRange);
          }}
        />

        <RangePicker
          value={customRange}
          disabled={disabled}
          allowEmpty={[true, true]}
          allowClear
          disabledDate={disabledDate}
          onCalendarChange={(dates) => setPicking(dates as [Dayjs | null, Dayjs | null] | null)}
          onOpenChange={(open) => {
            if (!open) setPicking(null);
          }}
          onChange={(dates) => {
            if (!dates || !dates[0] || !dates[1]) {
              onCustomRangeChange(null);
              return;
            }
            onCustomRangeChange([dates[0], dates[1]]);
          }}
          placeholder={['开始日期', '结束日期']}
        />

        {isAllShops && shopCount ? (
          <Tag color="warning">全店汇总 · {shopCount} 家门店</Tag>
        ) : null}
      </Space>

      <Typography.Text style={{ fontSize: 'var(--tf-font-xs)', color: brand.textSecondary }}>
        自定义区间最长 {MAX_RANGE_DAYS} 天，且不可选择未来日期；选择自定义区间后快捷范围自动取消。
      </Typography.Text>
    </Space>
  );
};

export default DashboardRangeControl;
