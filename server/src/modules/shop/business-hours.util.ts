import { BadRequestException } from '@nestjs/common';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

export const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
export type DayKey = (typeof DAY_KEYS)[number];

export interface TimeRange {
  start: string; // HH:mm
  end: string;   // HH:mm
}

export type BusinessHours = Record<DayKey, TimeRange[]>;

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const SHOP_TZ = process.env.SHOP_TIMEZONE || 'Asia/Shanghai';

export function emptyBusinessHours(): BusinessHours {
  return {
    sun: [],
    mon: [],
    tue: [],
    wed: [],
    thu: [],
    fri: [],
    sat: [],
  };
}

/** 默认全周 10:00-22:00，便于开发演示 */
export function defaultBusinessHours(): BusinessHours {
  const range = [{ start: '10:00', end: '22:00' }];
  return {
    sun: [...range],
    mon: [...range],
    tue: [...range],
    wed: [...range],
    thu: [...range],
    fri: [...range],
    sat: [...range],
  };
}

export function normalizeBusinessHours(input: unknown): BusinessHours {
  if (input == null) {
    return emptyBusinessHours();
  }
  if (typeof input === 'string') {
    try {
      return normalizeBusinessHours(JSON.parse(input));
    } catch {
      throw new BadRequestException('businessHours 不是合法 JSON');
    }
  }
  if (typeof input !== 'object' || Array.isArray(input)) {
    throw new BadRequestException('businessHours 必须是对象');
  }

  const raw = input as Record<string, unknown>;
  const result = emptyBusinessHours();

  for (const day of DAY_KEYS) {
    const ranges = raw[day];
    if (ranges == null) {
      result[day] = [];
      continue;
    }
    if (!Array.isArray(ranges)) {
      throw new BadRequestException(`businessHours.${day} 必须是数组`);
    }
    result[day] = ranges.map((item, index) => {
      if (!item || typeof item !== 'object') {
        throw new BadRequestException(`businessHours.${day}[${index}] 非法`);
      }
      const start = String((item as TimeRange).start || '');
      const end = String((item as TimeRange).end || '');
      if (!TIME_RE.test(start) || !TIME_RE.test(end)) {
        throw new BadRequestException(
          `businessHours.${day}[${index}] 时间格式须为 HH:mm`,
        );
      }
      if (start >= end) {
        throw new BadRequestException(
          `businessHours.${day}[${index}] start 必须早于 end`,
        );
      }
      return { start, end };
    });
  }

  return result;
}

export function isWithinBusinessHours(
  businessHours: BusinessHours | null | undefined,
  shopStatus: string,
  now: Date = new Date(),
): boolean {
  if (shopStatus === 'closed') {
    return false;
  }
  // 未配置营业时段：仅看开关店状态
  if (!businessHours) {
    return shopStatus === 'open';
  }

  const local = dayjs(now).tz(SHOP_TZ);
  const day = DAY_KEYS[local.day()];
  const ranges = businessHours[day] || [];
  if (ranges.length === 0) {
    return false;
  }
  const hhmm = local.format('HH:mm');
  return ranges.some((range) => hhmm >= range.start && hhmm < range.end);
}

export function nextOpenHint(
  businessHours: BusinessHours | null | undefined,
  shopStatus: string,
  now: Date = new Date(),
): string | null {
  if (shopStatus === 'closed') {
    return '店铺已打烊';
  }
  if (!businessHours || isWithinBusinessHours(businessHours, shopStatus, now)) {
    return null;
  }

  const local = dayjs(now).tz(SHOP_TZ);
  for (let offset = 0; offset < 7; offset += 1) {
    const d = local.add(offset, 'day');
    const day = DAY_KEYS[d.day()];
    const ranges = businessHours[day] || [];
    if (ranges.length === 0) continue;
    const first = ranges[0];
    if (offset === 0) {
      const later = ranges.find((r) => local.format('HH:mm') < r.start);
      if (later) {
        return `今日 ${later.start} 开始营业`;
      }
      continue;
    }
    const label = offset === 1 ? '明日' : d.format('MM-DD');
    return `${label} ${first.start} 开始营业`;
  }
  return '暂无营业时段';
}
