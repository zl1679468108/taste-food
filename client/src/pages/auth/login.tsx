import { useState } from 'react';
import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { useAuthStore } from '../../stores/authStore';
import './login.scss';

const LoginPage = () => {
  // Store 订阅（函数组件中正确订阅变化）
  const login = useAuthStore((s) => s.login);

  // 本地状态
  const [loading, setLoading] = useState(false);
  const [loadingCustomer, setLoadingCustomer] = useState(false);
  const [loadingRider, setLoadingRider] = useState(false);

  /** 模拟微信登录（管理员） */
  const mockAdminLogin = async () => {
    setLoading(true);
    try {
      await login('admin_code');
      Taro.showToast({ title: '管理员登录成功', icon: 'success' });
      setTimeout(() => {
        Taro.switchTab({ url: '/pages/menu/index' });
      }, 1000);
    } catch {
      // 错误已在 request 中处理
    } finally {
      setLoading(false);
    }
  };

  /** 模拟顾客登录 */
  const mockCustomerLogin = async () => {
    setLoadingCustomer(true);
    try {
      await login('customer_code');
      Taro.showToast({ title: '登录成功', icon: 'success' });
      setTimeout(() => {
        Taro.switchTab({ url: '/pages/menu/index' });
      }, 1000);
    } catch {
      // 错误已在 request 中处理
    } finally {
      setLoadingCustomer(false);
    }
  };

  /** 模拟骑手登录 */
  const mockRiderLogin = async () => {
    setLoadingRider(true);
    try {
      await login('rider_code');
      Taro.showToast({ title: '骑手登录成功', icon: 'success' });
      setTimeout(() => {
        Taro.switchTab({ url: '/pages/menu/index' });
      }, 1000);
    } catch {
      // 错误已在 request 中处理
    } finally {
      setLoadingRider(false);
    }
  };

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
          管理员: admin_code | 顾客: customer_code | 骑手: rider_code
        </Text>
      </View>

      {/* 模拟登录按钮 */}
      <View
        className={`login-page__btn ${loading ? 'login-page__btn--loading' : ''}`}
        onClick={() => !loading && !loadingCustomer && !loadingRider && mockAdminLogin()}
      >
        <Text className='login-page__btn-icon'>👨‍🍳</Text>
        <Text>{loading ? '登录中...' : '管理员模拟登录'}</Text>
      </View>

      {/* 骑手登录 */}
      <View
        className={`login-page__btn login-page__btn--rider ${loadingRider ? 'login-page__btn--loading' : ''}`}
        style={{ marginTop: '12px', backgroundColor: '#4CAF50' }}
        onClick={() => !loading && !loadingCustomer && !loadingRider && mockRiderLogin()}
      >
        <Text className='login-page__btn-icon'>🛵</Text>
        <Text>{loadingRider ? '登录中...' : '骑手模拟登录'}</Text>
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
        onClick={() => !loading && !loadingCustomer && mockCustomerLogin()}
      >
        {loadingCustomer ? '登录中...' : '顾客模拟登录'}
      </View>

      {/* 底部信息 */}
      <Text className='login-page__footer'>
        小买卖点餐系统 v1.0.0
      </Text>
    </View>
  );
};

export default LoginPage;
