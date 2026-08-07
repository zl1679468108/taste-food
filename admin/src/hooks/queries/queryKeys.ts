/**
 * 全局 query key 工厂
 * 统一命名，方便 invalidate、prefetch 和 DevTools 里识别
 */
export const queryKeys = {
  // ---------- shop ----------
  shops: {
    all: () => ['shops'] as const,
    list: () => ['shops', 'list'] as const,
    detail: (id: string) => ['shops', 'detail', id] as const,
    businessHours: (id: string) => ['shops', 'businessHours', id] as const,
  },

  // ---------- menu ----------
  categories: {
    all: () => ['categories'] as const,
    list: (shopId: string) => ['categories', 'list', shopId] as const,
  },
  menuItems: {
    all: () => ['menuItems'] as const,
    list: (params: { shopId: string; categoryId?: string; search?: string }) =>
      ['menuItems', 'list', params] as const,
    detail: (id: string) => ['menuItems', 'detail', id] as const,
  },
  specGroups: {
    all: () => ['specGroups'] as const,
    list: (shopId: string) => ['specGroups', 'list', shopId] as const,
  },

  // ---------- order ----------
  orders: {
    all: () => ['orders'] as const,
    list: (params: { shopId: string; allShops?: boolean; status?: string; page: number; pageSize: number }) =>
      ['orders', 'list', params] as const,
    detail: (id: string) => ['orders', 'detail', id] as const,
    statsToday: (shopId?: string) => ['orders', 'stats', 'today', shopId] as const,
    statsPending: (shopId?: string) => ['orders', 'stats', 'pending', shopId] as const,
    statsDaily: (
      shopId: string | undefined,
      days: number,
      rangeKey?: string,
    ) => ['orders', 'stats', 'daily', shopId, days, rangeKey || ''] as const,
  },

  // ---------- promotion ----------
  promotions: {
    all: () => ['promotions'] as const,
    list: (shopId?: string) => ['promotions', 'list', shopId] as const,
  },

  // ---------- user ----------
  users: {
    all: () => ['users'] as const,
    list: (params: {
      page: number;
      pageSize: number;
      role?: string;
      keyword?: string;
      status?: string;
      registeredWithinDays?: number;
    }) => ['users', 'list', params] as const,
    me: () => ['users', 'me'] as const,
    profile: (id: string) => ['users', 'profile', id] as const,
  },

  // ---------- 顾客管理（商家视角，§3.24 / T313） ----------
  customers: {
    all: () => ['customers'] as const,
    list: (params: {
      page: number;
      pageSize: number;
      keyword?: string;
      sortBy?: string;
      hasOrderWithinDays?: number;
    }) => ['customers', 'list', params] as const,
    profile: (id: string) => ['customers', 'profile', id] as const,
  },

  // ---------- 站内信（商家 → 顾客，§3.25 / T314） ----------
  messages: {
    all: () => ['messages'] as const,
    list: (params: { toUserId?: string; page?: number; pageSize?: number }) =>
      ['messages', 'list', params] as const,
  },

  // ---------- notification ----------
  notifications: {
    all: () => ['notifications'] as const,
    list: (page: number, pageSize: number) => ['notifications', 'list', page, pageSize] as const,
    unreadCount: () => ['notifications', 'unreadCount'] as const,
  },

  // ---------- role application ----------
  roleApplications: {
    all: () => ['roleApplications'] as const,
    list: (status?: string) => ['roleApplications', 'list', status] as const,
    mine: () => ['roleApplications', 'mine'] as const,
    eligibility: (role?: string, shopName?: string) =>
      ['roleApplications', 'eligibility', role, shopName] as const,
  },

  // ---------- audit ----------
  auditLogs: {
    all: () => ['auditLogs'] as const,
    list: (params: { page: number; pageSize: number; method?: string }) =>
      ['auditLogs', 'list', params] as const,
  },

  // ---------- 批量异步导出（T267） ----------
  exportJobs: {
    all: () => ['exportJobs'] as const,
    list: (params: { shopId: string; status?: string; page?: number; pageSize?: number }) =>
      ['exportJobs', 'list', params] as const,
  },

  // ---------- table ----------
  tables: {
    all: () => ['tables'] as const,
    list: (shopId: string) => ['tables', 'list', shopId] as const,
  },
} as const;
