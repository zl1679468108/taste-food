export default definePageConfig({
  navigationBarTitleText: '评价管理',
  navigationBarBackgroundColor: '#FF6B35',
  navigationBarTextStyle: 'white',
  backgroundColor: '#f5f5f5',
  enablePullDownRefresh: true,
});

function definePageConfig(config: {
  navigationBarTitleText?: string;
  navigationBarBackgroundColor?: string;
  navigationBarTextStyle?: 'black' | 'white';
  backgroundColor?: string;
  enablePullDownRefresh?: boolean;
}) {
  return config;
}
