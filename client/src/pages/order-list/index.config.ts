export default definePageConfig({
  navigationBarTitleText: '我的订单',
  navigationBarBackgroundColor: '#ffffff',
  navigationBarTextStyle: 'black',
  backgroundColor: '#f5f5f5',
});

function definePageConfig(config: {
  navigationBarTitleText?: string;
  navigationBarBackgroundColor?: string;
  navigationBarTextStyle?: 'black' | 'white';
  backgroundColor?: string;
  disableScroll?: boolean;
  usingComponents?: Record<string, string>;
}) {
  return config;
}
