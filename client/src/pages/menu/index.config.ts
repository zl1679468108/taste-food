export default definePageConfig({
  navigationBarTitleText: '小买卖点餐',
  navigationBarBackgroundColor: '#FF6B35',
  navigationBarTextStyle: 'white',
  backgroundColor: '#f5f5f5',
  disableScroll: false,
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
