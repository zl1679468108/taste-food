export default defineAppConfig({
  pages: [
    'pages/menu/index',
    'pages/order-confirm/index',
    'pages/order-detail/index',
    'pages/order-list/index',
    'pages/mine/index',
    'pages/admin/index',
    'pages/rider/index',
    'pages/mine/role-apply',
    'pages/mine/notifications',
    'pages/auth/login',
    'pages/auth/register',
    'pages/favorites/index',
    'pages/reviews/index',
    'pages/address/index',
    'pages/address/edit',
    'pages/admin/menu-manage',
    'pages/admin/user-manage',
    'pages/admin/reviews',
  ],
  window: {
    navigationBarTitleText: '小买卖点餐',
    navigationBarBackgroundColor: '#FF6B35',
    navigationBarTextStyle: 'white',
    backgroundColor: '#F5F5F5',
    backgroundTextStyle: 'dark',
  },
  permission: {
    'scope.userLocation': {
      desc: '用于选择配送地址、展示配送轨迹与骑手位置上报',
    },
  },
  // startLocationUpdate / onLocationChange 用于骑手配送中的实时无感定位
  requiredPrivateInfos: ['getLocation', 'chooseLocation', 'startLocationUpdate', 'onLocationChange'],
  tabBar: {
    custom: true,
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
        pagePath: 'pages/admin/index',
        text: '工作台',
        iconPath: 'assets/icons/menu.png',
        selectedIconPath: 'assets/icons/menu-active.png',
      },
      {
        pagePath: 'pages/rider/index',
        text: '接单',
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
