import { useState } from 'react';
import { View, Text, Input } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { useAuthStore, navigateByRole } from '../../stores/authStore';
import './register.scss';

export default function RegisterPage() {
  const register = useAuthStore((s) => s.register);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [nickName, setNickName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (loading) return;
    const u = username.trim();
    const p = password;
    if (!u || u.length < 3) {
      Taro.showToast({ title: '用户名至少 3 位', icon: 'none' });
      return;
    }
    if (!p || p.length < 6) {
      Taro.showToast({ title: '密码至少 6 位', icon: 'none' });
      return;
    }
    setLoading(true);
    try {
      const user = await register({
        username: u,
        password: p,
        nickName: nickName.trim() || undefined,
        phone: phone.trim() || undefined,
        intentRole: 'customer',
      });
      Taro.showToast({ title: '注册成功', icon: 'success' });
      setTimeout(() => navigateByRole(user.role), 600);
    } catch {
      // request 已提示
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className='register-page'>
      <Text className='register-page__title'>创建账号</Text>
      <Text className='register-page__subtitle'>注册即为顾客，商家/骑手可在「我的」页申请</Text>

      <View className='register-page__field'>
        <Text className='register-page__label'>用户名</Text>
        <Input
          className='register-page__input'
          placeholder='登录账号'
          value={username}
          onInput={(e) => setUsername(e.detail.value)}
        />
      </View>
      <View className='register-page__field'>
        <Text className='register-page__label'>密码</Text>
        <Input
          className='register-page__input'
          password
          placeholder='至少 6 位'
          value={password}
          onInput={(e) => setPassword(e.detail.value)}
        />
      </View>
      <View className='register-page__field'>
        <Text className='register-page__label'>昵称（可选）</Text>
        <Input
          className='register-page__input'
          placeholder='展示名称'
          value={nickName}
          onInput={(e) => setNickName(e.detail.value)}
        />
      </View>
      <View className='register-page__field'>
        <Text className='register-page__label'>手机号（可选）</Text>
        <Input
          className='register-page__input'
          type='number'
          placeholder='联系电话'
          value={phone}
          onInput={(e) => setPhone(e.detail.value)}
        />
      </View>

      <View
        className={`register-page__btn${loading ? ' is-loading' : ''}`}
        onClick={() => !loading && handleSubmit()}
      >
        <Text>{loading ? '提交中...' : '注册并登录'}</Text>
      </View>

      <Text
        className='register-page__back'
        onClick={() => Taro.navigateBack({ fail: () => Taro.redirectTo({ url: '/pages/auth/login' }) })}
      >
        已有账号？去登录
      </Text>
    </View>
  );
}
