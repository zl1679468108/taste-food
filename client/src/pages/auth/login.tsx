import { Component } from 'react';
import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { useAuthStore } from '../../stores/authStore';
import './login.scss';

interface LoginPageState {
  loading: boolean;
  loadingCustomer: boolean;
}

export default class LoginPage extends Component<{}, LoginPageState> {
  private authStore = useAuthStore;

  constructor(props: {}) {
    super(props);
    this.state = {
      loading: false,
      loadingCustomer: false,
    };
  }

  /** 模拟微信登录（管理员） */
  async mockAdminLogin() {
    this.setState({ loading: true });
    try {
      await this.authStore.getState().login('admin_code');
      Taro.showToast({ title: '管理员登录成功', icon: 'success' });
      setTimeout(() => {
        Taro.switchTab({ url: '/pages/menu/index' });
      }, 1000);
    } catch {
      // 错误已在 request 中处理
    } finally {
      this.setState({ loading: false });
    }
  }

  /** 模拟顾客登录 */
  async mockCustomerLogin() {
    this.setState({ loadingCustomer: true });
    try {
      await this.authStore.getState().login('customer_code');
      Taro.showToast({ title: '登录成功', icon: 'success' });
      setTimeout(() => {
        Taro.switchTab({ url: '/pages/menu/index' });
      }, 1000);
    } catch {
      // 错误已在 request 中处理
    } finally {
      this.setState({ loadingCustomer: false });
    }
  }

  render() {
    const { loading, loadingCustomer } = this.state;

    return (
      <View className='login-page'>
        {/* Logo */}
        <View className='login-page__logo'>🍖</View>

        {/* 标题 */}
        <Text className='login-page__title'>小买卖点餐</Text>
        <Text className='login-page__subtitle'>
          微信授权登录后即可开始点餐
        </Text>

        {/* 说明 */}
        <View className='login-page__desc'>
          <Text className='login-page__desc-title'>💡 开发说明</Text>
          <Text className='login-page__desc-text'>
            当前为开发环境，微信登录功能不可用。请使用模拟登录按钮进行测试。
            {'\n'}
            管理员 code: admin_code | 顾客 code: customer_code
          </Text>
        </View>

        {/* 模拟登录按钮 */}
        <View
          className={`login-page__btn ${loading ? 'login-page__btn--loading' : ''}`}
          onClick={() => !loading && !loadingCustomer && this.mockAdminLogin()}
        >
          <Text className='login-page__btn-icon'>👨‍🍳</Text>
          <Text>{loading ? '登录中...' : '管理员模拟登录'}</Text>
        </View>

        {/* 分隔线 */}
        <View className='login-page__divider'>
          <View className='login-page__divider-line' />
          <Text className='login-page__divider-text'>或</Text>
          <View className='login-page__divider-line' />
        </View>

        {/* 顾客登录 */}
        <View
          className='login-page__mock-btn'
          onClick={() => !loading && !loadingCustomer && this.mockCustomerLogin()}
        >
          {loadingCustomer ? '登录中...' : '顾客模拟登录'}
        </View>

        {/* 底部信息 */}
        <Text className='login-page__footer'>
          小买卖点餐系统 v1.0.0
        </Text>
      </View>
    );
  }
}
