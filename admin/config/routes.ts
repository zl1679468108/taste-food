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
  },
  {
    name: '店铺管理',
    path: '/shop',
    icon: 'ShopOutlined',
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
    ],
  },
  {
    name: '菜品管理',
    path: '/menu',
    icon: 'CoffeeOutlined',
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
  },
  {
    name: '用户管理',
    path: '/user',
    component: './User',
    icon: 'TeamOutlined',
  },
  {
    name: '促销管理',
    path: '/promotion',
    component: './Promotion',
    icon: 'GiftOutlined',
  },
];