/**
 * 审计日志展示层中文映射
 * - 新数据：后端写入时已是中文 action/summary
 * - 旧数据：兼容英文 action/summary（如 "PATCH menu-items"）
 */

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
  unknown: '未知',
};

/** 审计页角色展示：admin 显示「管理员」 */
export const AUDIT_ROLE_LABELS: Record<string, string> = {
  admin: '管理员',
  customer: '顾客',
  rider: '骑手',
};

const METHOD_VERB: Record<string, string> = {
  POST: '新建',
  PUT: '更新',
  PATCH: '更新',
  DELETE: '删除',
};

const PATH_ACTION_RULES: Array<{
  test: RegExp;
  label: string | ((method: string) => string);
}> = [
  { test: /\/orders\/[^/]+\/status(?:\/|$|\?)/, label: '更新订单状态' },
  { test: /\/orders\/[^/]+\/cancel(?:\/|$|\?)/, label: '取消订单' },
  { test: /\/orders\/[^/]+\/reorder(?:\/|$|\?)/, label: '再来一单' },
  { test: /\/orders\/[^/]+\/grab(?:\/|$|\?)/, label: '骑手接单' },
  { test: /\/orders\/[^/]+\/deliver(?:\/|$|\?)/, label: '确认送达' },
  { test: /\/orders\/[^/]+\/pay(?:\/|$|\?)/, label: '支付订单' },
  { test: /\/orders\/[^/]+\/reviews(?:\/|$|\?)/, label: '创建评价' },
  { test: /\/orders\/[^/]+\/delivery-track(?:\/|$|\?)/, label: '更新配送轨迹' },
  { test: /\/orders\/rider\/location(?:\/|$|\?)/, label: '上报骑手位置' },
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

function hasChinese(text: string): boolean {
  return /[\u4e00-\u9fff]/.test(text);
}

function resourceFromPath(path: string): string | undefined {
  const clean = path.split('?')[0].replace(/^\/api\/?/, '/');
  const parts = clean.split('/').filter(Boolean);
  if (parts.length === 0) return undefined;
  if (parts[0] === 'shops' && parts.includes('tables')) return 'tables';
  if (parts[0] === 'orders' && parts.includes('reviews')) return 'reviews';
  return parts[0];
}

function buildActionFromMethodResource(
  method: string,
  pathOrResource: string,
): string {
  const m = (method || '').toUpperCase();
  const raw = pathOrResource || '';

  // path-like
  if (raw.includes('/')) {
    for (const rule of PATH_ACTION_RULES) {
      if (rule.test.test(raw)) {
        return typeof rule.label === 'function' ? rule.label(m) : rule.label;
      }
    }
    const resource = resourceFromPath(raw);
    const verb = METHOD_VERB[m] || m;
    return `${verb}${AUDIT_RESOURCE_LABELS[resource || ''] || resource || '资源'}`;
  }

  // resource key like "menu-items"
  const verb = METHOD_VERB[m] || m;
  return `${verb}${AUDIT_RESOURCE_LABELS[raw] || raw || '资源'}`;
}

export function getAuditResourceLabel(resource?: string | null): string {
  if (!resource) return '-';
  return AUDIT_RESOURCE_LABELS[resource] || resource;
}

export function getAuditRoleLabel(role?: string | null): string {
  if (!role) return '';
  return AUDIT_ROLE_LABELS[role.toLowerCase()] || role;
}

/**
 * 动作中文化（兼容旧英文 "PATCH menu-items" / 已中文数据）
 */
export function getAuditActionLabel(
  action?: string | null,
  method?: string | null,
  resource?: string | null,
  path?: string | null,
): string {
  // 旧英文动作优先：以 HTTP 方法开头
  if (action) {
    const matched = action.match(
      /^(GET|POST|PUT|PATCH|DELETE)\s+(.+)$/i,
    );
    if (matched) {
      return buildActionFromMethodResource(matched[1], matched[2].trim());
    }
  }

  if (action && hasChinese(action)) return action;

  if (method && (path || resource)) {
    return buildActionFromMethodResource(method, path || resource || '');
  }

  return action || '-';
}

/**
 * 摘要中文化（兼容旧英文 "PATCH /api/menu-items/xxx status=active name=麻辣烤鱼"）
 */
export function getAuditSummaryLabel(
  summary?: string | null,
  opts?: {
    action?: string | null;
    method?: string | null;
    resource?: string | null;
    path?: string | null;
  },
): string {
  if (!summary) {
    const actionLabel = getAuditActionLabel(
      opts?.action,
      opts?.method,
      opts?.resource,
      opts?.path,
    );
    return actionLabel !== '-' ? actionLabel : '-';
  }

  // 旧英文摘要：以 HTTP 方法开头（即使 name 含中文也要本地化）
  const matched = summary.match(
    /^(GET|POST|PUT|PATCH|DELETE)\s+(\S+)(.*)$/i,
  );
  if (matched) {
    const method = matched[1].toUpperCase();
    const path = matched[2];
    const rest = matched[3] || '';
    const action = buildActionFromMethodResource(method, path);

    const status = rest.match(/(?:^|\s)status=(\S+)/)?.[1];
    const tableNo = rest.match(/(?:^|\s)tableNo=(\S+)/)?.[1];
    const nameFromBody = rest.match(/(?:^|\s)name=(\S+)/)?.[1];
    const hasReply = /(?:^|\s)reply(?:\s|$)/.test(rest);
    const name = nameFromBody || tableNo;

    const extras: string[] = [];
    if (status) extras.push(`status=${status}`);
    if (tableNo && nameFromBody) extras.push(`桌号=${tableNo}`);
    if (hasReply) extras.push('含回复');

    let result = action;
    if (name) result += `：${name}`;
    if (extras.length > 0) {
      result += name ? `（${extras.join('，')}）` : `：${extras.join('，')}`;
    }
    return result;
  }

  // 新中文摘要或其它自定义摘要直接展示
  if (hasChinese(summary)) return summary;

  // fallback: 用动作中文
  const actionLabel = getAuditActionLabel(
    opts?.action,
    opts?.method,
    opts?.resource,
    opts?.path,
  );
  return actionLabel !== '-' ? actionLabel : summary;
}
