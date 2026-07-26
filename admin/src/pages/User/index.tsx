import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Table, Tag, Typography, Avatar, Space } from 'antd';
import { UserOutlined, TeamOutlined } from '@ant-design/icons';
import { getUsers, User } from '@/services/user';
import SearchFilterBar from '@/components/SearchFilterBar';
import { formatTime, shortOrderId } from '@/utils/format';
import PageHeaderActions from '@/components/PageHeaderActions';
import TableCard from '@/components/TableCard';
import { DEFAULT_TABLE_PAGINATION, DEFAULT_TABLE_LOCALE } from '@/utils/table';
import { brand } from '@/theme';

const { Text } = Typography;

const roleMap: Record<string, { color: string; text: string }> = {
  customer: { color: 'blue', text: '顾客' },
  admin: { color: 'red', text: '商家' },
  rider: { color: 'green', text: '骑手' },
};

/** openid 脱敏：保留前 4 + 后 4 */
function maskOpenid(openid?: string): string {
  if (!openid) return '-';
  if (openid.length <= 10) return `${openid.slice(0, 2)}***`;
  return `${openid.slice(0, 4)}****${openid.slice(-4)}`;
}

const UserPage: React.FC = () => {
  const [searchText, setSearchText] = useState('');
  const [roleFilter, setRoleFilter] = useState<string | undefined>();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      // 用户量通常不大：一次多拉，前端筛选/分页
      const res = await getUsers({ page: 1, pageSize: 200 });
      setUsers(res?.items || []);
    } catch (error) {
      console.error('加载用户失败:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const filteredUsers = useMemo(() => {
    const keyword = searchText.trim().toLowerCase();
    return users.filter((u) => {
      const name = (u.nickName || '').toLowerCase();
      const id = (u.id || '').toLowerCase();
      const openid = (u.openid || '').toLowerCase();
      const matchKeyword =
        !keyword ||
        name.includes(keyword) ||
        id.includes(keyword) ||
        openid.includes(keyword);
      const matchRole = !roleFilter || u.role === roleFilter;
      return matchKeyword && matchRole;
    });
  }, [users, searchText, roleFilter]);

  const columns = [
    {
      title: '用户',
      key: 'user',
      width: 240,
      render: (_: unknown, record: User) => (
        <Space size={12}>
          <Avatar
            src={record.avatarUrl}
            icon={<UserOutlined />}
            size={40}
            style={{ backgroundColor: brand.primary, flexShrink: 0 }}
          />
          <div style={{ minWidth: 0 }}>
            <div>
              <Text strong ellipsis style={{ maxWidth: 160, display: 'inline-block' }}>
                {record.nickName || '未命名用户'}
              </Text>
            </div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              ID {shortOrderId(record.id)}
            </Text>
          </div>
        </Space>
      ),
    },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      width: 100,
      render: (role: string) => {
        const config = roleMap[role] || { color: 'default', text: role || '-' };
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: 'OpenID',
      dataIndex: 'openid',
      key: 'openid',
      width: 180,
      ellipsis: true,
      render: (openid: string) => (
        <Text type="secondary" style={{ fontFamily: 'monospace', fontSize: 12 }}>
          {maskOpenid(openid)}
        </Text>
      ),
    },
    {
      title: '用户 ID',
      dataIndex: 'id',
      key: 'id',
      width: 140,
      render: (id: string) => (
        <Text copyable={{ text: id }} style={{ fontFamily: 'monospace', fontSize: 12 }}>
          {shortOrderId(id)}
        </Text>
      ),
    },
    {
      title: '注册时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 170,
      render: (time: string) => formatTime(time, 'YYYY-MM-DD HH:mm'),
    },
  ];

  return (
    <div className="tf-page">
      <PageHeaderActions
        icon={<TeamOutlined style={{ marginRight: 8 }} />}
        title="用户管理"
        onRefresh={loadUsers}
      />

      <TableCard>
        <SearchFilterBar
          searchPlaceholder="搜索昵称 / ID / openid"
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
          size="small"
          locale={DEFAULT_TABLE_LOCALE}
          scroll={{ x: 900 }}
          pagination={{
            ...DEFAULT_TABLE_PAGINATION,
            showTotal: (t) => `共 ${t} 条`,
          }}
        />
      </TableCard>
    </div>
  );
};

export default UserPage;
