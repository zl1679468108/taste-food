import React, { useState } from 'react';
import { Card, Button, Typography, Space, Divider, message } from 'antd';
import { ShopOutlined, SafetyOutlined } from '@ant-design/icons';
import { history } from '@umijs/max';
import { loginAsAdmin } from '@/services/auth';

const { Title, Text, Paragraph } = Typography;

const LoginPage: React.FC = () => {
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    try {
      const result = await loginAsAdmin();
      if (result && result.token) {
        localStorage.setItem('token', result.token);
        if (result.refreshToken) {
          localStorage.setItem('refreshToken', result.refreshToken);
        }
        localStorage.setItem('user', JSON.stringify(result));
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
    <div style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '20px',
    }}>
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
            <div style={{ 
              fontSize: 64, 
              lineHeight: '64px',
              marginBottom: 16,
            }}>
              🍜
            </div>
            <Title level={2} style={{ marginBottom: 8 }}>小买卖管理后台</Title>
            <Text type="secondary">商家管理系统</Text>
          </div>

          <Divider />
          
          <div>
            <Paragraph type="secondary" style={{ marginBottom: 16 }}>
              点击下方按钮以管理员身份登录
            </Paragraph>
            <Button 
              type="primary" 
              size="large" 
              block 
              loading={loading}
              onClick={handleLogin}
              icon={<SafetyOutlined />}
              style={{ height: 48, fontSize: 16 }}
            >
              管理员登录
            </Button>
          </div>
          
          <div style={{ 
            background: '#f6f8fa', 
            borderRadius: 8, 
            padding: '12px 16px',
            textAlign: 'left',
          }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              <ShopOutlined style={{ marginRight: 8 }} />
              登录后可管理菜品、订单、用户等
            </Text>
          </div>
        </Space>
      </Card>
    </div>
  );
};

export default LoginPage;