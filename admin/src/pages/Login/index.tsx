import React, { useState } from 'react';
import { Button, Card, Form, Input, Typography, Space, Divider, message } from 'antd';
import {
  UserOutlined,
  LockOutlined,
  CoffeeOutlined,
  SafetyOutlined,
  ShopOutlined,
} from '@ant-design/icons';
import { history, useModel } from '@umijs/max';
import {
  passwordLogin,
  seedDemoMerchant,
  persistAuthSession,
  toCurrentUser,
  homePathForRole,
} from '@/services/auth';
import { brand } from '@/theme';

const { Title, Text, Paragraph } = Typography;

const LoginPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [form] = Form.useForm();
  const { setInitialState } = useModel('@@initialState');

  const handleLogin = async (values: { username: string; password: string }) => {
    setLoading(true);
    try {
      const result = await passwordLogin({
        username: values.username.trim(),
        password: values.password,
      });
      persistAuthSession(result);
      const currentUser = toCurrentUser(result);
      await setInitialState({
        currentUser,
        admin: {
          canOps: result.role === 'admin' || result.role === 'merchant',
          canPlatform: result.role === 'admin' && !result.shopId,
          canMerchant: result.role === 'merchant',
          canAdmin: result.role === 'admin' || result.role === 'merchant',
          canPlatformAdmin: result.role === 'admin' && !result.shopId,
        },
      });
      message.success('登录成功');
      history.push(homePathForRole(result.role));
    } catch {
      // 全局拦截器已 toast
    } finally {
      setLoading(false);
    }
  };

  const handleSeedMerchant = async () => {
    setSeeding(true);
    try {
      const demo = await seedDemoMerchant();
      form.setFieldsValue({
        username: demo.username,
        password: demo.password,
      });
      message.success(`测试商家已就绪：${demo.username} / ${demo.password}`);
    } catch {
      // toast by interceptor
    } finally {
      setSeeding(false);
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
            <div
              style={{
                fontSize: 56,
                lineHeight: '56px',
                marginBottom: 16,
                color: brand.primary,
              }}
            >
              <CoffeeOutlined />
            </div>
            <Title level={2} style={{ marginBottom: 8 }}>
              小买卖管理后台
            </Title>
            <Text type="secondary">账号密码登录 · 多角色入口</Text>
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
                placeholder="用户名"
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
                placeholder="密码"
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
              登录
            </Button>
          </Form>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <a onClick={() => history.push('/register')} style={{ color: brand.primary, cursor: 'pointer' }}>没有账号？去注册</a>
            <Button type="link" size="small" loading={seeding} onClick={handleSeedMerchant}>
              填充测试商家
            </Button>
          </div>

          <div>
            <Paragraph type="secondary" style={{ marginBottom: 0, fontSize: 12 }}>
              <SafetyOutlined style={{ marginRight: 4 }} />
              开发提示：平台管理员 admin / admin123；商家可点「填充测试商家」
            </Paragraph>
          </div>
        </Space>
      </Card>
    </div>
  );
};

export default LoginPage;
