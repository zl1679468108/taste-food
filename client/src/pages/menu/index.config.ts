export default definePageConfig({
  navigationBarTitleText: '小买卖点餐',
  navigationBarBackgroundColor: '#e74c3c',
  navigationBarTextStyle: 'white',
  backgroundColor: '#f5f5f5',
  disableScroll: false,
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
