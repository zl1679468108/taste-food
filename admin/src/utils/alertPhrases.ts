/**
 * 商家后台语音播报话术单一数据源。
 *
 * - 播放端（orderAlertSound.ts）、设置页（VoiceAlertSettings）、生成脚本
 *   （scripts/gen-alert-voice.mjs）共用本模块的话术文本与命名哈希，
 *   保证「生成文件」与「播放时查找文件」用的是同一套文本与命名，文件名不错位。
 * - 文案风格：温润规范、围绕订单状态流转（待接单 / 催单 / 取消(退款)申请 /
 *   骑手接单 / 新评价），不俏皮、不二次元。
 * - 触发场景均为「商家视角」下需要听得到的 inbound 事件。
 *
 * 重要状态话术采用「每状态系统提供 3 个候选，商家挑选 1 个作为当前生效」：
 *   VOICE_OPTIONS 每个重要状态固定 3 条，每条带稳定 id（与文本解耦），
 *   商家选择只需存 id，话术文案后续微调也不影响已保存的配置。
 */

export type AdminOrderAlertKind =
  | 'order_paid'
  | 'order_cancel_request'
  | 'order_reminder'
  | 'rider_assigned'
  | 'new_review'
  | 'default';

/** 单条语音候选：id 稳定（商家选择按 id 存），text 为实际播报话术 */
export interface VoiceOption {
  id: string;
  text: string;
}

/**
 * 每个重要状态系统提供的 3 个候选话术（商家可从中挑选 1 个）。
 * 顺序即为设置页展示顺序；id 一旦确定不应变更（否则会丢失商家已选）。
 */
export const VOICE_OPTIONS: Record<AdminOrderAlertKind, VoiceOption[]> = {
  order_paid: [
    { id: 'order_paid_1', text: '您有一笔新订单，请及时处理' },
    { id: 'order_paid_2', text: '新订单已支付，请尽快接单' },
    { id: 'order_paid_3', text: '有新的待接订单，请关注处理' },
  ],
  order_cancel_request: [
    { id: 'order_cancel_request_1', text: '有顾客发起取消申请，请尽快审核' },
    { id: 'order_cancel_request_2', text: '收到一笔取消申请，请及时处理' },
    { id: 'order_cancel_request_3', text: '顾客申请取消订单，请确认' },
  ],
  // 顾客催单：厨房压力信号，需商家立刻感知
  order_reminder: [
    { id: 'order_reminder_1', text: '温馨提示，有顾客正在催单，请加快出餐' },
    { id: 'order_reminder_2', text: '顾客催单提醒，请尽快处理当前订单' },
    { id: 'order_reminder_3', text: '您有一笔订单被催单，请及时处理' },
  ],
  // 骑手接单 / 到店取餐出发（外卖单）
  rider_assigned: [
    { id: 'rider_assigned_1', text: '骑手已接单，外卖订单正在配送途中' },
    { id: 'rider_assigned_2', text: '骑手已取餐出发，请关注配送进度' },
    { id: 'rider_assigned_3', text: '外卖订单骑手已接单，即将送达顾客' },
  ],
  // 顾客完成评价
  new_review: [
    { id: 'new_review_1', text: '您收到一条新的顾客评价，请查看' },
    { id: 'new_review_2', text: '有顾客完成评价，感谢您的用心' },
    { id: 'new_review_3', text: '新的评价来啦，快看看顾客的反馈' },
  ],
  default: [{ id: 'default_1', text: '您有新的消息' }],
};

/** 设置页展示顺序（仅重要状态，不含 default 兜底） */
export const VOICE_KIND_ORDER: AdminOrderAlertKind[] = [
  'order_paid',
  'order_cancel_request',
  'order_reminder',
  'rider_assigned',
  'new_review',
];

/** 每个重要状态在设置页的展示名 */
export const VOICE_KIND_LABELS: Record<AdminOrderAlertKind, string> = {
  order_paid: '新订单已支付',
  order_cancel_request: '退款 / 售后申请',
  order_reminder: '顾客催单',
  rider_assigned: '骑手接单 / 取餐',
  new_review: '顾客新评价',
  default: '其他消息',
};

/** 兼容派生：字符串数组形态（供生成脚本与旧引用使用） */
export const PHRASE_POOL: Record<AdminOrderAlertKind, string[]> = Object.fromEntries(
  (Object.keys(VOICE_OPTIONS) as AdminOrderAlertKind[]).map((k) => [
    k,
    VOICE_OPTIONS[k].map((o) => o.text),
  ]),
) as Record<AdminOrderAlertKind, string[]>;

/** 朗读/生成前清洗：去掉会被 TTS 念出的装饰符号（如波浪号 ~、～ 常被读成「波/浪」） */
export function sanitizeForSpeech(text: string): string {
  return text.replace(/[~～]/g, '').trim();
}

/**
 * 由「清洗后的文案」生成稳定文件名。
 * 用 djb2 哈希转十六进制，保证播放端与服务端生成脚本算出的文件名一致。
 */
export function phraseToFile(phrase: string): string {
  const key = sanitizeForSpeech(phrase);
  let h = 5381;
  for (let i = 0; i < key.length; i++) {
    h = ((h << 5) + h + key.charCodeAt(i)) >>> 0;
  }
  return `alert-${h.toString(16)}.mp3`;
}

/** 预生成语音文件所在目录（admin 静态资源，构建后位于 /sounds/alert/） */
export const ALERT_VOICE_DIR = '/sounds/alert/';

/** 默认豆包音色（温柔桃子 2.0，温润自然，适合规范播报） */
export const DEFAULT_DOUBAO_VOICE = 'zh_female_tianmeitaozi_uranus_bigtts';
