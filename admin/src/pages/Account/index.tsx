import React from 'react';
import { Avatar, Col, Descriptions, Empty, Row, Space, Tag, Typography } from 'antd';
import { SwapOutlined, UserOutlined } from '@ant-design/icons';
import { useModel } from '@umijs/max';
import { brand } from '@/theme';
import RoleSwitcher from '@/components/RoleSwitcher';
import PageHeaderActions from '@/components/PageHeaderActions';
import TableCard from '@/components/TableCard';

const { Title, Text } = Typography;

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
  const canSwitchRole =
    roles.length > 1 || role !== 'customer' || (roles.length === 1 && roles[0].role !== role);

  return (
    <div className="tf-page">
      <PageHeaderActions
        icon={<UserOutlined style={{ marginRight: 8 }} />}
        title="我的中心"
      />

      <Row gutter={[16, 16]} style={{ alignItems: 'stretch' }}>
        <Col xs={24} lg={10} style={{ display: 'flex', flexDirection: 'column' }}>
          <TableCard title="账号信息" style={{ flex: 1 }}>
            <Space align="start" size={16}>
              <Avatar
                size={48}
                icon={<UserOutlined />}
                style={{
                  background: brand.primaryLight,
                  color: brand.primary,
                  flexShrink: 0,
                }}
              />
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
              style={{ marginTop: brand.space5 }}
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
          </TableCard>
        </Col>

        <Col xs={24} lg={14} style={{ display: 'flex', flexDirection: 'column' }}>
          <TableCard
            title={
              <Space>
                <SwapOutlined />
                <span>角色切换</span>
              </Space>
            }
            style={{ flex: 1 }}
          >
            {canSwitchRole ? (
              <RoleSwitcher />
            ) : (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="当前仅有一个角色，可在「我的申请」中申请商家/骑手"
              />
            )}
          </TableCard>
        </Col>
      </Row>
    </div>
  );
};

export default AccountPage;
