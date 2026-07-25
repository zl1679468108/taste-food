export default [
  {
    path: '/login',
    component: './Login',
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
    name: '店铺管理',
    path: '/shop',
    icon: 'ShopOutlined',
    access: 'canAdmin',
    routes: [
      {
        name: '店铺信息',
        path: '/shop/info',
        component: './Shop',
      },
      {
        name: '多店铺管理',
        path: '/shop/manage',
        component: './ShopManage',
      },
      {
        name: '桌台与扫码',
        path: '/shop/tables',
        component: './Shop/Tables',
      },
    ],
  },
  {
    name: '菜品管理',
    path: '/menu',
    icon: 'CoffeeOutlined',
    access: 'canAdmin',
    routes: [
      {
        name: '分类管理',
        path: '/menu/category',
        component: './Menu/Category',
      },
      {
        name: '菜品列表',
        path: '/menu/item',
        component: './Menu/Item',
      },
    ],
  },
  {
    name: '订单管理',
    path: '/order',
    component: './Order',
    icon: 'OrderedListOutlined',
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
    name: '促销管理',
    path: '/promotion',
    component: './Promotion',
    icon: 'GiftOutlined',
    access: 'canAdmin',
  },
  {
    name: '操作审计',
    path: '/audit',
    component: './Audit',
    icon: 'AuditOutlined',
    access: 'canAdmin',
  },
];
