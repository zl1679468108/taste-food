export default [
  {
    path: '/login',
    component: './Login',
    layout: false,
  },
  {
    path: '/register',
    component: './Register',
    layout: false,
  },
  {
    path: '/',
    redirect: '/dashboard',
  },
  {
    name: '数据看板',
    path: '/dashboard',
    component: './Dashboard',
    icon: 'DashboardOutlined',
    access: 'canAdmin',
  },
  {
    name: '订单管理',
    path: '/order',
    component: './Order',
    icon: 'OrderedListOutlined',
    access: 'canAdmin',
  },
  {
    name: '菜品管理',
    path: '/menu',
    icon: 'CoffeeOutlined',
    access: 'canAdmin',
    routes: [
      {
        name: '菜品列表',
        path: '/menu/item',
        component: './Menu/Item',
      },
      {
        name: '分类管理',
        path: '/menu/category',
        component: './Menu/Category',
      },
    ],
  },
  {
    name: '促销管理',
    path: '/promotion',
    component: './Promotion',
    icon: 'GiftOutlined',
    access: 'canAdmin',
  },
  {
    name: '用户管理',
    path: '/user',
    component: './User',
    icon: 'TeamOutlined',
    access: 'canAdmin',
  },
  {
    // 一级菜单：多店铺管理（原「多店铺管理」提升；店铺信息/桌台整合进编辑）
    name: '店铺管理',
    path: '/shop',
    component: './ShopManage',
    icon: 'ShopOutlined',
    access: 'canAdmin',
  },
  // 旧路径兼容跳转
  {
    path: '/shop/info',
    redirect: '/shop',
  },
  {
    path: '/shop/manage',
    redirect: '/shop',
  },
  {
    path: '/shop/tables',
    redirect: '/shop',
  },
  {
    name: '审批中心',
    path: '/approvals',
    component: './Approvals',
    icon: 'SafetyCertificateOutlined',
    access: 'canPlatformAdmin',
  },
  {
    name: '操作审计',
    path: '/audit',
    component: './Audit',
    icon: 'AuditOutlined',
    access: 'canPlatformAdmin',
  },
  {
    name: '消息中心',
    path: '/messages',
    component: './Messages',
    icon: 'BellOutlined',
  },
  {
    name: '我的申请',
    path: '/applications',
    component: './Applications',
    icon: 'FormOutlined',
  },
  {
    name: '我的中心',
    path: '/account',
    component: './Account',
    icon: 'UserOutlined',
  },
]
