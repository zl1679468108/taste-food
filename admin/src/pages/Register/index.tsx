import React, { useState } from 'react';
import { Button, Card, Form, Input, Typography, Space, Divider, message } from 'antd';
import {
  UserOutlined,
  LockOutlined,
  CoffeeOutlined,
  MobileOutlined,
  IdcardOutlined,
} from '@ant-design/icons';
import { history, useModel } from '@umijs/max';
import {
  register,
  persistAuthSession,
  toCurrentUser,
  homePathForRole,
} from '@/services/auth';
import { brand } from '@/theme';

const { Title, Text } = Typography;

const RegisterPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();
  const { setInitialState } = useModel('@@initialState');

  const handleRegister = async (values: {
    username: string;
    password: string;
    nickName?: string;
    phone?: string;
  }) => {
    setLoading(true);
    try {
      const result = await register({
        username: values.username.trim(),
        password: values.password,
        nickName: values.nickName?.trim(),
        phone: values.phone?.trim(),
        intentRole: 'customer',
      });
      persistAuthSession(result);
      const currentUser = toCurrentUser(result);
      await setInitialState({
        currentUser,
        admin: {
          canOps: false,
          canPlatform: false,
          canMerchant: false,
          canAdmin: false,
          canPlatformAdmin: false,
        },
      });
      message.success('注册成功');
      history.push(homePathForRole(result.role));
    } catch {
      // interceptor toast
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: `linear-gradient(135deg, ${brand.primary} 0%, ${brand.primaryDark} 100%)`,
        padding: '20px',
      }}
    >
      <Card
        style={{
          width: 460,
          textAlign: 'center',
          borderRadius: 12,
          boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
        }}
      >
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div>
            <div
              style={{
                fontSize: 48,
                lineHeight: '48px',
                marginBottom: 12,
                color: brand.primary,
              }}
            >
              <CoffeeOutlined />
            </div>
            <Title level={3} style={{ marginBottom: 8 }}>
              注册账号
            </Title>
            <Text type="secondary">注册即为顾客，登录后可在「我的中心」申请商家/骑手</Text>
          </div>

          <Divider />

          <Form
            form={form}
            layout="vertical"
            requiredMark={false}
            onFinish={handleRegister}
            style={{ textAlign: 'left' }}
          >
            <Form.Item
              name="username"
              label="用户名"
              rules={[
                { required: true, message: '请输入用户名' },
                {
                  pattern: /^[a-zA-Z0-9_]{3,32}$/,
                  message: '3-32 位字母数字下划线',
                },
              ]}
            >
              <Input prefix={<UserOutlined />} placeholder="登录用户名" size="large" />
            </Form.Item>
            <Form.Item
              name="password"
              label="密码"
              rules={[
                { required: true, message: '请输入密码' },
                { min: 6, message: '至少 6 位' },
              ]}
            >
              <Input.Password prefix={<LockOutlined />} placeholder="至少 6 位" size="large" />
            </Form.Item>
            <Form.Item name="nickName" label="昵称">
              <Input prefix={<IdcardOutlined />} placeholder="选填" size="large" />
            </Form.Item>
            <Form.Item name="phone" label="手机号">
              <Input prefix={<MobileOutlined />} placeholder="选填" size="large" />
            </Form.Item>
            <Button type="primary" htmlType="submit" size="large" block loading={loading}>
              注册并登录
            </Button>
          </Form>

          <div>
            <a onClick={() => history.push('/login')} style={{ color: brand.primary, cursor: 'pointer' }}>已有账号？去登录</a>
          </div>
        </Space>
      </Card>
    </div>
  );
};

export default RegisterPage;
