/** 审计资源英文 key → 中文名（resource 字段仍存英文） */
export const AUDIT_RESOURCE_LABELS: Record<string, string> = {
  'menu-items': '菜品',
  categories: '分类',
  orders: '订单',
  promotions: '优惠活动',
  shops: '店铺',
  users: '用户',
  reviews: '评价',
  storage: '图片存储',
  tables: '桌台',
  addresses: '地址',
  favorites: '收藏',
  'audit-logs': '审计日志',
  auth: '认证',
  health: '健康检查',
  notifications: '通知',
  payment: '支付',
};

const METHOD_VERB: Record<string, string> = {
  POST: '新建',
  PUT: '更新',
  PATCH: '更新',
  DELETE: '删除',
};

const PATH_ACTION_RULES: Array<{ test: RegExp; label: string | ((method: string) => string) }> = [
  { test: /\/orders\/[^/]+\/status(?:\/|$|\?)/, label: '更新订单状态' },
  { test: /\/orders\/[^/]+\/cancel(?:\/|$|\?)/, label: '取消订单' },
  { test: /\/orders\/[^/]+\/reorder(?:\/|$|\?)/, label: '再来一单' },
  { test: /\/orders\/[^/]+\/grab(?:\/|$|\?)/, label: '骑手接单' },
  { test: /\/orders\/[^/]+\/deliver(?:\/|$|\?)/, label: '确认送达' },
  { test: /\/orders\/[^/]+\/pay(?:\/|$|\?)/, label: '支付订单' },
  { test: /\/orders\/[^/]+\/reviews(?:\/|$|\?)/, label: '创建评价' },
  { test: /\/orders\/rider\/location(?:\/|$|\?)/, label: '上报骑手位置' },
  { test: /\/orders\/[^/]+\/delivery-track(?:\/|$|\?)/, label: '更新配送轨迹' },
  { test: /\/reviews\/[^/]+\/reply(?:\/|$|\?)/, label: '回复评价' },
  { test: /\/shops\/[^/]+\/tables\/seed(?:\/|$|\?)/, label: '初始化桌台' },
  {
    test: /\/shops\/[^/]+\/tables(?:\/|$|\?)/,
    label: (method) => {
      if (method === 'POST') return '新建桌台';
      if (method === 'DELETE') return '删除桌台';
      return '更新桌台';
    },
  },
  { test: /\/shops\/[^/]+\/business-hours(?:\/|$|\?)/, label: '更新营业时间' },
  { test: /\/shops\/[^/]+\/status(?:\/|$|\?)/, label: '更新店铺状态' },
  {
    test: /\/storage\/images/,
    label: (method) => (method === 'DELETE' ? '删除图片' : '上传图片'),
  },
  {
    test: /\/addresses\/[^/]+\/(?:default|set-default)(?:\/|$|\?)/,
    label: '设置默认地址',
  },
  { test: /\/favorites\/toggle(?:\/|$|\?)/, label: '切换收藏' },
];

export function getResourceLabel(resource?: string): string {
  if (!resource) return '资源';
  return AUDIT_RESOURCE_LABELS[resource] || resource;
}

/** 根据 method + path + resource 生成中文动作 */
export function buildAuditAction(
  method: string,
  path: string,
  resource?: string,
): string {
  const m = (method || '').toUpperCase();
  const p = path || '';

  for (const rule of PATH_ACTION_RULES) {
    if (rule.test.test(p)) {
      return typeof rule.label === 'function' ? rule.label(m) : rule.label;
    }
  }

  const verb = METHOD_VERB[m] || m;
  const resCn = getResourceLabel(resource);
  return `${verb}${resCn}`;
}

/** 生成中文可读摘要，例如：更新菜品：麻辣烤鱼（status=active） */
export function buildAuditSummary(
  method: string,
  path: string,
  body: unknown,
  resource?: string,
): string {
  const action = buildAuditAction(method, path, resource);
  const b =
    body && typeof body === 'object' ? (body as Record<string, unknown>) : {};

  const nameFromBody =
    b.name != null
      ? String(b.name).trim()
      : b.title != null
        ? String(b.title).trim()
        : '';
  const tableNo =
    b.tableNo != null && String(b.tableNo).trim() !== ''
      ? String(b.tableNo).trim()
      : '';
  // 无 name 时把桌号当作主体；有 name 时桌号放括号附加信息
  const nameRaw = nameFromBody || tableNo;
  const extras: string[] = [];
  if (b.status != null && String(b.status).trim() !== '') {
    extras.push(`status=${b.status}`);
  }
  if (tableNo && nameFromBody) {
    extras.push(`桌号=${tableNo}`);
  }
  if (b.reply != null && String(b.reply).trim() !== '') {
    extras.push('含回复');
  }

  let summary = action;
  if (nameRaw) {
    summary += `：${nameRaw}`;
  }
  if (extras.length > 0) {
    summary += nameRaw ? `（${extras.join('，')}）` : `：${extras.join('，')}`;
  }
  return summary.slice(0, 500);
}
