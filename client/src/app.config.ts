export default defineAppConfig({
  pages: [
    'pages/menu/index',
    'pages/order-confirm/index',
    'pages/order-detail/index',
    'pages/order-list/index',
    'pages/auth/login',
    'pages/admin/index',
    'pages/admin/menu-manage',
  ],
  window: {
    navigationBarTitleText: '小买卖点餐',
    navigationBarBackgroundColor: '#ffffff',
    navigationBarTextStyle: 'black',
    backgroundColor: '#f5f5f5',
    backgroundTextStyle: 'dark',
  },
  tabBar: {
    color: '#999999',
    selectedColor: '#e74c3c',
    backgroundColor: '#ffffff',
    borderStyle: 'black',
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
    ],
  },
});

function defineAppConfig(config: {
  pages: string[];
  window?: {
    navigationBarTitleText?: string;
    navigationBarBackgroundColor?: string;
    navigationBarTextStyle?: 'black' | 'white';
    backgroundColor?: string;
    backgroundTextStyle?: 'dark' | 'light';
  };
  tabBar?: {
    color: string;
    selectedColor: string;
    backgroundColor: string;
    borderStyle?: 'black' | 'white';
    list: {
      pagePath: string;
      text: string;
      iconPath?: string;
      selectedIconPath?: string;
    }[];
  };
}) {
  return config;
}
