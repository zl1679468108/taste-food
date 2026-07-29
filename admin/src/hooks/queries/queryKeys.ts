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

  // ---------- order ----------
  orders: {
    all: () => ['orders'] as const,
    list: (params: { shopId: string; status?: string; page: number; pageSize: number }) =>
      ['orders', 'list', params] as const,
    detail: (id: string) => ['orders', 'detail', id] as const,
    statsToday: (shopId?: string) => ['orders', 'stats', 'today', shopId] as const,
    statsDaily: (shopId: string | undefined, days: number) =>
      ['orders', 'stats', 'daily', shopId, days] as const,
    statsStatus: (shopId?: string, days?: number) =>
      ['orders', 'stats', 'status', shopId, days] as const,
  },

  // ---------- promotion ----------
  promotions: {
    all: () => ['promotions'] as const,
    list: (shopId?: string) => ['promotions', 'list', shopId] as const,
  },

  // ---------- user ----------
  users: {
    all: () => ['users'] as const,
    list: (params: { page: number; pageSize: number; role?: string }) =>
      ['users', 'list', params] as const,
    me: () => ['users', 'me'] as const,
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

  // ---------- table ----------
  tables: {
    all: () => ['tables'] as const,
    list: (shopId: string) => ['tables', 'list', shopId] as const,
  },
} as const;
