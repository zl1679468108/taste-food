export default definePageConfig({
  navigationBarTitleText: '我的',
  navigationBarBackgroundColor: '#FF6B35',
  navigationBarTextStyle: 'white',
  backgroundColor: '#f5f5f5',
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
