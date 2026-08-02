export default [
  { path: '/login', component: './Login', layout: false },
  { path: '/register', component: './Register', layout: false },
  { path: '/', component: './Entry', layout: false },

  // ── 公共（两端通用） ──────────────────────────────────────
  { name: '个人中心', path: '/account', component: './Account', icon: 'UserOutlined' },

  // ── 平台端（platform） ───────────────────────────────────
  { path: '/platform', redirect: '/platform/dashboard', access: 'canPlatformAdmin' },
  { name: '数据看板', path: '/platform/dashboard', component: './Dashboard', icon: 'DashboardOutlined', access: 'canPlatformAdmin' },
  { name: '审批中心', path: '/platform/approvals', component: './Approvals', icon: 'SafetyCertificateOutlined', access: 'canPlatformAdmin' },
  { name: '操作审计', path: '/platform/audit', component: './Audit', icon: 'AuditOutlined', access: 'canPlatformAdmin' },

  // ── 商家端（merchant） ───────────────────────────────────
  { path: '/merchant', redirect: '/merchant/dashboard', access: 'canMerchant' },
  { name: '数据看板', path: '/merchant/dashboard', component: './Dashboard', icon: 'DashboardOutlined', access: 'canMerchant' },
  { name: '订单管理', path: '/merchant/order', component: './Order', icon: 'OrderedListOutlined', access: 'canMerchant' },
  { name: '菜品管理', path: '/merchant/menu', icon: 'CoffeeOutlined', access: 'canMerchant', routes: [
    { name: '菜品列表', path: '/merchant/menu/item', component: './Menu/Item' },
    { name: '分类管理', path: '/merchant/menu/category', component: './Menu/Category' },
    { name: '规格管理', path: '/merchant/menu/spec-group', component: './SpecGroup' },
  ]},
  { name: '促销管理', path: '/merchant/promotion', component: './Promotion', icon: 'GiftOutlined', access: 'canMerchant' },
  { name: '用户管理', path: '/merchant/user', component: './User', icon: 'TeamOutlined', access: 'canMerchant' },
  { name: '店铺管理', path: '/merchant/shop', component: './ShopManage', icon: 'ShopOutlined', access: 'canMerchant' },
  { name: '导出中心', path: '/merchant/export', component: './Export', icon: 'FileExcelOutlined', access: 'canMerchant' },
  { name: '语音播报', path: '/merchant/voice-alert', component: './VoiceAlertSettings', icon: 'SoundOutlined', access: 'canMerchant' },

  // ── 其他 ────────────────────────────────────────────────
  { path: '/messages', component: './Messages' },
  { path: '/applications', redirect: '/account' },
]
