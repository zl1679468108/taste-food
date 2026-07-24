import React, { useEffect, useState, useMemo } from 'react';
import { Table, Tag, Typography, Avatar, Card, Space, Button, Input, Select, message} from 'antd';
import { UserOutlined, TeamOutlined, ReloadOutlined } from '@ant-design/icons';
import { getUsers, User } from '@/services/user';
import SearchFilterBar from '@/components/SearchFilterBar';
import { formatTime } from '@/utils/format';
import PageHeaderActions from '@/components/PageHeaderActions';
import TableCard from '@/components/TableCard';

const { Title, Text } = Typography;

const UserPage: React.FC = () => {
  const [searchText, setSearchText] = useState('');
  const [roleFilter, setRoleFilter] = useState<string | undefined>();
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
      message.error('加载用户失败');
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
          style={{ backgroundColor: '#FF6B35' }}
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

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const name = (u.nickName || '').toLowerCase();
      const matchName = !searchText.trim() || name.includes(searchText.trim().toLowerCase());
      const matchRole = !roleFilter || u.role === roleFilter;
      return matchName && matchRole;
    });
  }, [users, searchText, roleFilter]);

  return (
    <div>
      <PageHeaderActions
      icon={<TeamOutlined style={{ marginRight: 8 }} />}
      title="用户管理"
      onRefresh={loadUsers}
    />

      <TableCard>
              <SearchFilterBar
        searchPlaceholder="搜索用户昵称"
        onSearch={setSearchText}
        onSearchClear={() => setSearchText('')}
        filterPlaceholder="按角色筛选"
        filterValue={roleFilter}
        filterOptions={[
          { label: '顾客', value: 'customer' },
          { label: '商家', value: 'admin' },
          { label: '骑手', value: 'rider' },
        ]}
        onFilterChange={setRoleFilter}
      />
      <Table
          columns={columns}
          dataSource={filteredUsers}
          rowKey="id"
          loading={loading}
          pagination={{
            current: page,
            total,
            pageSize: 10,
            onChange: setPage,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50'],
            showTotal: (total) => `共 ${total} 条`,
          }}
        />
      </TableCard>
    </div>
  );
};

export default UserPage;
