import React from 'react';
import { Card, Descriptions, Space, Typography, Button, Tag, Empty } from 'antd';
import {
  BellOutlined,
  FormOutlined,
  SwapOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { history, useModel } from '@umijs/max';
import { brand } from '@/theme';
import RoleSwitcher from '@/components/RoleSwitcher';

const { Title, Text, Paragraph } = Typography;

const roleLabel: Record<string, string> = {
  admin: '平台管理员',
  merchant: '商家',
  rider: '骑手',
  customer: '顾客',
};

const AccountPage: React.FC = () => {
  const { initialState } = useModel('@@initialState');
  const user = initialState?.currentUser;
  const roles = user?.roles || [];
  const role = user?.role || 'customer';

  return (
    <div style={{ maxWidth: 840, margin: '0 auto' }}>
      <Title level={4} style={{ marginBottom: 16 }}>
        我的中心
      </Title>
      <Paragraph type="secondary" style={{ marginBottom: 24 }}>
        顾客 / 骑手使用轻量中心；商家与管理员可从菜单进入运营功能。
      </Paragraph>

      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Card>
          <Space align="start" size={16}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                background: brand.primaryLight || '#FFF3E0',
                color: brand.primary,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 22,
              }}
            >
              <UserOutlined />
            </div>
            <div>
              <Title level={5} style={{ margin: 0 }}>
                {user?.name || '用户'}
              </Title>
              <Text type="secondary">{user?.username || user?.id}</Text>
            </div>
          </Space>
          <Descriptions
            column={1}
            size="small"
            style={{ marginTop: 20 }}
            items={[
              {
                key: 'role',
                label: '当前角色',
                children: <Tag color="orange">{roleLabel[role] || role}</Tag>,
              },
              {
                key: 'shop',
                label: '绑定店铺',
                children: user?.shopId || '—',
              },
              {
                key: 'phone',
                label: '手机号',
                children: user?.phone || '—',
              },
              {
                key: 'roles',
                label: '可用角色',
                children:
                  roles.length > 0 ? (
                    <Space wrap>
                      {roles.map((r: API.UserRoleItem) => (
                        <Tag key={`${r.role}-${r.shopId || ''}`}>
                          {roleLabel[r.role] || r.role}
                        </Tag>
                      ))}
                    </Space>
                  ) : (
                    roleLabel[role] || role
                  ),
              },
            ]}
          />
        </Card>

        <Card
          title={
            <Space>
              <SwapOutlined />
              角色切换
            </Space>
          }
        >
          {roles.length > 1 || (roles.length === 1 && roles[0].role !== role) ? (
            <RoleSwitcher />
          ) : (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="当前仅有一个角色，可在「我的申请」中申请商家/骑手"
            />
          )}
        </Card>

        <Card>
          <Space wrap>
            <Button
              type="primary"
              icon={<FormOutlined />}
              onClick={() => history.push('/applications')}
            >
              我的申请
            </Button>
            <Button icon={<BellOutlined />} onClick={() => history.push('/messages')}>
              消息中心
            </Button>
            {(role === 'admin' || role === 'merchant') && (
              <Button onClick={() => history.push('/dashboard')}>进入运营后台</Button>
            )}
          </Space>
        </Card>
      </Space>
    </div>
  );
};

export default AccountPage;
