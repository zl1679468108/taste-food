export default definePageConfig({
  navigationBarTitleText: '身份申请',
  navigationBarBackgroundColor: '#FF6B35',
  navigationBarTextStyle: 'white',
  backgroundColor: '#f5f5f5',
});

function definePageConfig(config: {
  navigationBarTitleText?: string;
  navigationBarBackgroundColor?: string;
  navigationBarTextStyle?: 'black' | 'white';
  backgroundColor?: string;
}) {
  return config;
}
