import React, { useEffect, useState } from 'react';
import { Table, Tag, Typography, Avatar, Card, Space, Button } from 'antd';
import { UserOutlined, TeamOutlined, ReloadOutlined } from '@ant-design/icons';
import { getUsers, User } from '@/services/user';
import { formatTime } from '@/utils/format';

const { Title, Text } = Typography;

const UserPage: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    loadUsers();
  }, [page]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const res = await getUsers({ page, pageSize: 10 });
      setUsers(res?.items || []);
      setTotal(res?.total || 0);
    } catch (error) {
      console.error('加载用户失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const roleMap: Record<string, { color: string; text: string }> = {
    customer: { color: 'blue', text: '顾客' },
    admin: { color: 'red', text: '管理员' },
    rider: { color: 'green', text: '骑手' },
  };

  const columns = [
    {
      title: '头像',
      dataIndex: 'avatarUrl',
      key: 'avatarUrl',
      render: (url: string) => (
        <Avatar
          src={url}
          icon={<UserOutlined />}
          size={40}
          style={{ backgroundColor: '#1890ff' }}
        />
      ),
    },
    {
      title: '昵称',
      dataIndex: 'nickName',
      key: 'nickName',
      render: (name: string) => <Text strong>{name || '-'}</Text>,
    },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      render: (role: string) => {
        const config = roleMap[role] || { color: 'default', text: role };
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: '注册时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (time: string) => formatTime(time),
    },
  ];

  return (
    <div >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0 }}>
          <TeamOutlined style={{ marginRight: 8 }} />
          用户管理
        </Title>
        <Button icon={<ReloadOutlined />} onClick={loadUsers}>
          刷新
        </Button>
      </div>

      <Card
        bordered={false}
        style={{
          borderRadius: 8,
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        }}
      >
        <Table
          columns={columns}
          dataSource={users}
          rowKey="id"
          loading={loading}
          pagination={{
            current: page,
            total,
            pageSize: 10,
            onChange: setPage,
            showSizeChanger: false,
            showTotal: (total) => `共 ${total} 条`,
          }}
        />
      </Card>
    </div>
  );
};

export default UserPage;