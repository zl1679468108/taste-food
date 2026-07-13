export default definePageConfig({
  navigationBarTitleText: '我的订单',
  navigationBarBackgroundColor: '#ffffff',
  navigationBarTextStyle: 'black',
  backgroundColor: '#f5f5f5',
  enablePullDownRefresh: true,
});

function definePageConfig(config: {
  navigationBarTitleText?: string;
  navigationBarBackgroundColor?: string;
  navigationBarTextStyle?: 'black' | 'white';
  backgroundColor?: string;
  disableScroll?: boolean;
  enablePullDownRefresh?: boolean;
  usingComponents?: Record<string, string>;
}) {
  return config;
}
