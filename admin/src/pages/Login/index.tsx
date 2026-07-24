import React, { useState } from 'react';
import { Card, Button, Typography, Space, Divider, message, Form, Input } from 'antd';
import { ShopOutlined, SafetyOutlined, UserOutlined, LockOutlined } from '@ant-design/icons';
import { history, useModel } from '@umijs/max';
import { loginAsAdmin } from '@/services/auth';
import { brand } from '@/theme';

const { Title, Text, Paragraph } = Typography;

interface LoginFormValues {
  username: string;
  password: string;
}

const LoginPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm<LoginFormValues>();
  const { setInitialState } = useModel('@@initialState');

  const handleLogin = async (values?: LoginFormValues) => {
    // 开发态：账号密码仅做前端校验，实际走模拟管理员登录
    if (values) {
      if (!values.username?.trim() || !values.password?.trim()) {
        message.warning('请输入账号和密码');
        return;
      }
    }

    setLoading(true);
    try {
      const result = await loginAsAdmin();
      if (result && result.token) {
        localStorage.setItem('token', result.token);
        if (result.refreshToken) {
          localStorage.setItem('refreshToken', result.refreshToken);
        }
        localStorage.setItem('user', JSON.stringify(result));
        await setInitialState((s) => ({
          ...s,
          currentUser: {
            id: result.userId,
            name: result.nickName || '商家管理员',
            role: result.role,
            shopId: result.shopId,
          } as API.CurrentUser,
          admin: { canAdmin: result.role === 'admin' },
        }));
        message.success('登录成功');
        history.push('/dashboard');
      } else {
        message.error('登录失败，未获取到 token');
      }
    } catch (error) {
      console.error('登录失败:', error);
      message.error('登录失败，请重试');
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
          width: 420,
          textAlign: 'center',
          borderRadius: 12,
          boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
        }}
      >
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div>
            <div style={{ fontSize: 64, lineHeight: '64px', marginBottom: 16 }}>🍜</div>
            <Title level={2} style={{ marginBottom: 8 }}>
              小买卖管理后台
            </Title>
            <Text type="secondary">商家管理系统</Text>
          </div>

          <Divider />

          <Form
            form={form}
            layout="vertical"
            requiredMark={false}
            onFinish={handleLogin}
            initialValues={{ username: 'admin', password: 'admin123' }}
            style={{ textAlign: 'left' }}
          >
            <Form.Item
              name="username"
              label="账号"
              rules={[{ required: true, message: '请输入账号' }]}
            >
              <Input
                prefix={<UserOutlined />}
                placeholder="请输入账号"
                size="large"
                autoComplete="username"
              />
            </Form.Item>
            <Form.Item
              name="password"
              label="密码"
              rules={[{ required: true, message: '请输入密码' }]}
            >
              <Input.Password
                prefix={<LockOutlined />}
                placeholder="请输入密码"
                size="large"
                autoComplete="current-password"
              />
            </Form.Item>

            <Button
              type="primary"
              htmlType="submit"
              size="large"
              block
              loading={loading}
              icon={<ShopOutlined />}
            >
              登录管理后台
            </Button>
          </Form>

          <div>
            <Paragraph type="secondary" style={{ marginBottom: 0, fontSize: 12 }}>
              <SafetyOutlined style={{ marginRight: 4 }} />
              开发环境使用模拟登录（任意账号密码即可）
            </Paragraph>
          </div>
        </Space>
      </Card>
    </div>
  );
};

export default LoginPage;
