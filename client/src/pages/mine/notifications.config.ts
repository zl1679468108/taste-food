export default definePageConfig({
  navigationBarTitleText: '消息中心',
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
