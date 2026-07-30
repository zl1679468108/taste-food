import { useState } from 'react';
import { View, Text, Input, Image } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { useAuthStore, navigateByRole } from '../../stores/authStore';
import Icon from '../../components/Icon';
import brandLogo from '../../assets/images/brand-logo.png';
import './login.scss';

const LoginPage = () => {
  const login = useAuthStore((s) => s.login);
  const passwordLogin = useAuthStore((s) => s.passwordLogin);

  const [mode, setMode] = useState<'wechat' | 'password'>('wechat');
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const afterLogin = (role?: string) => {
    Taro.showToast({ title: '登录成功', icon: 'success' });
    setTimeout(() => navigateByRole(role), 600);
  };

  /** 微信登录（真机 wx.login；开发可走 mock code） */
  const handleWechatLogin = async (mockCode?: string) => {
    if (loading) return;
    setLoading(true);
    try {
      let code = mockCode;
      if (!code) {
        try {
          const res = await Taro.login();
          code = res?.code;
        } catch {
          // H5/开发工具可能无微信登录
        }
      }
      if (!code) {
        Taro.showToast({ title: '获取微信 code 失败，请用账号登录', icon: 'none' });
        setMode('password');
        return;
      }
      const user = await login(code);
      afterLogin(user.role);
    } catch {
      // 错误已在 request 中处理
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordLogin = async () => {
    if (loading) return;
    const u = username.trim();
    const p = password;
    if (!u || !p) {
      Taro.showToast({ title: '请输入账号和密码', icon: 'none' });
      return;
    }
    setLoading(true);
    try {
      const user = await passwordLogin(u, p);
      afterLogin(user.role);
    } catch {
      // request 已提示
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className='login-page'>
      <View className='login-page__logo'>
        <Image className='login-page__logo-img' src={brandLogo} mode='aspectFill' />
      </View>

      <Text className='login-page__title'>小买卖点餐</Text>
      <Text className='login-page__subtitle'>登录后点餐 · 申请商家/骑手</Text>

      {mode === 'wechat' ? (
        <>
          <View className='login-page__desc'>
            <View className='login-page__desc-title'>
              <Icon name='info' size={16} color='#FF6B35' />
              <Text>温馨提示</Text>
            </View>
            <Text className='login-page__desc-text'>
              支持微信授权登录；也可使用账号密码。商家与骑手需提交申请，由管理员审批后生效。小程序不提供管理员入口。
            </Text>
          </View>

          <View
            className={`login-page__btn ${loading ? 'login-page__btn--loading' : ''}`}
            onClick={() => !loading && handleWechatLogin()}
          >
            <View className='login-page__btn-icon'>
              <Icon name='user' size={20} color='#FFFFFF' />
            </View>
            <Text>{loading ? '登录中...' : '微信一键登录'}</Text>
          </View>

          <View className='login-page__divider'>
            <View className='login-page__divider-line' />
            <Text className='login-page__divider-text'>或</Text>
            <View className='login-page__divider-line' />
          </View>

          <View
            className='login-page__mock-btn'
            onClick={() => !loading && setMode('password')}
          >
            账号密码登录
          </View>

          {/* 开发快捷：模拟顾客微信登录 */}
          <View
            className='login-page__link'
            onClick={() => !loading && handleWechatLogin('customer_code')}
          >
            开发：模拟顾客微信登录
          </View>
          <View
            className='login-page__link'
            onClick={() => !loading && handleWechatLogin('rider_code')}
          >
            开发：模拟骑手微信登录
          </View>
        </>
      ) : (
        <View className='login-page__form'>
          <View className='login-page__field'>
            <Text className='login-page__label'>
              账号
              <Text className='form-required'>*</Text>
            </Text>
            <Input
              className='login-page__input'
              placeholder='用户名 / 手机号'
              value={username}
              onInput={(e) => setUsername(e.detail.value)}
            />
          </View>
          <View className='login-page__field'>
            <Text className='login-page__label'>
              密码
              <Text className='form-required'>*</Text>
            </Text>
            <Input
              className='login-page__input'
              password
              placeholder='请输入密码'
              value={password}
              onInput={(e) => setPassword(e.detail.value)}
            />
          </View>

          <View
            className={`login-page__btn ${loading ? 'login-page__btn--loading' : ''}`}
            onClick={() => !loading && handlePasswordLogin()}
          >
            <Text>{loading ? '登录中...' : '登录'}</Text>
          </View>

          <View className='login-page__form-actions'>
            <Text className='login-page__link' onClick={() => setMode('wechat')}>
              返回微信登录
            </Text>
            <Text
              className='login-page__link login-page__link--primary'
              onClick={() => Taro.navigateTo({ url: '/pages/auth/register' })}
            >
              注册账号
            </Text>
          </View>

          <View className='login-page__hint'>
            <Text className='login-page__hint-text'>演示商家：merchant / merchant123</Text>
            <Text className='login-page__hint-text'>演示骑手：rider / rider123</Text>
          </View>
        </View>
      )}

      {mode === 'wechat' && (
        <View
          className='login-page__register'
          onClick={() => Taro.navigateTo({ url: '/pages/auth/register' })}
        >
          <Text>没有账号？</Text>
          <Text className='login-page__register-link'>去注册</Text>
        </View>
      )}

      <Text className='login-page__footer'>小买卖点餐系统 v1.0.0</Text>
    </View>
  );
};

export default LoginPage;
