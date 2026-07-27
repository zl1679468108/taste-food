export default defineAppConfig({
  pages: [
    'pages/menu/index',
    'pages/order-confirm/index',
    'pages/order-detail/index',
    'pages/order-list/index',
    'pages/mine/index',
    'pages/mine/role-apply',
    'pages/mine/notifications',
    'pages/auth/login',
    'pages/auth/register',
    'pages/favorites/index',
    'pages/reviews/index',
    'pages/address/index',
    'pages/address/edit',
  ],
  subpackages: [
    {
      root: 'pages/admin',
      pages: [
        'index',
        'menu-manage',
        'user-manage',
        'reviews',
      ],
    },
    {
      root: 'pages/rider',
      pages: [
        'index',
      ],
    },
  ],
  window: {
    navigationBarTitleText: '小买卖点餐',
    navigationBarBackgroundColor: '#FF6B35',
    navigationBarTextStyle: 'white',
    backgroundColor: '#F5F5F5',
    backgroundTextStyle: 'dark',
  },
  tabBar: {
    color: '#999999',
    selectedColor: '#FF6B35',
    backgroundColor: '#ffffff',
    borderStyle: 'white',
    list: [
      {
        pagePath: 'pages/menu/index',
        text: '菜单',
        iconPath: 'assets/icons/menu.png',
        selectedIconPath: 'assets/icons/menu-active.png',
      },
      {
        pagePath: 'pages/order-list/index',
        text: '订单',
        iconPath: 'assets/icons/order.png',
        selectedIconPath: 'assets/icons/order-active.png',
      },
      {
        pagePath: 'pages/mine/index',
        text: '我的',
        iconPath: 'assets/icons/mine.png',
        selectedIconPath: 'assets/icons/mine-active.png',
      },
    ],
  },
});

function defineAppConfig(config: any) {
  return config;
}
