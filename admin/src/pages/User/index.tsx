import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  Table,
  Tag,
  Typography,
  Avatar,
  Space,
  Button,
  Modal,
  Form,
  Input,
  Select,
  message,
} from 'antd';
import { UserOutlined, TeamOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import { useModel } from '@umijs/max';
import {
  getUsers,
  createUser,
  updateUser,
  updateMe,
  User,
} from '@/services/user';
import { getShops, Shop } from '@/services/shop';
import SearchFilterBar from '@/components/SearchFilterBar';
import { formatTime, shortOrderId } from '@/utils/format';
import PageHeaderActions from '@/components/PageHeaderActions';
import TableCard from '@/components/TableCard';
import { DEFAULT_TABLE_PAGINATION, DEFAULT_TABLE_LOCALE } from '@/utils/table';
import { brand } from '@/theme';

const { Text } = Typography;

const roleMap: Record<string, { color: string; text: string }> = {
  customer: { color: 'blue', text: '顾客' },
  admin: { color: 'red', text: '平台管理员' },
  merchant: { color: 'orange', text: '商家' },
  rider: { color: 'green', text: '骑手' },
};

/** openid 脱敏：保留前 4 + 后 4 */
function maskOpenid(openid?: string): string {
  if (!openid) return '-';
  if (openid.length <= 10) return `${openid.slice(0, 2)}***`;
  return `${openid.slice(0, 4)}****${openid.slice(-4)}`;
}

function resolveRoleLabel(role: string, shopId?: string): string {
  if (role === 'admin') {
    return shopId ? '商家(兼容)' : '平台管理员';
  }
  if (role === 'merchant') return '商家';
  return roleMap[role]?.text || role || '-';
}

const UserPage: React.FC = () => {
  const { initialState, setInitialState } = useModel('@@initialState');
  const currentUser = initialState?.currentUser;
  const isPlatformAdmin = !!currentUser && currentUser.role === 'admin' && !currentUser.shopId;
  const isMerchantUser = currentUser?.role === 'merchant' || (!!currentUser?.shopId && currentUser?.role === 'admin');

  const [searchText, setSearchText] = useState('');
  const [roleFilter, setRoleFilter] = useState<string | undefined>();
  const [users, setUsers] = useState<User[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();
  const watchRole = Form.useWatch('role', form);
  const watchAccountType = Form.useWatch('accountType', form);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getUsers({ page: 1, pageSize: 200 });
      setUsers(
        (res?.items || []).map((u: any) => ({
          ...u,
          createdAt: u.createdAt || u.registerDate || '',
          shopId: u.shopId,
        })),
      );
    } catch (error) {
      console.error('加载用户失败:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadShops = useCallback(async () => {
    if (!isPlatformAdmin) return;
    try {
      const list = await getShops();
      setShops(list || []);
    } catch (e) {
      console.error('加载店铺失败:', e);
    }
  }, [isPlatformAdmin]);

  useEffect(() => {
    loadUsers();
    loadShops();
  }, [loadUsers, loadShops]);

  const shopNameMap = useMemo(() => {
    const map = new Map<string, string>();
    shops.forEach((s) => map.set(s.id, s.name));
    return map;
  }, [shops]);

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

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ role: 'customer' });
    setModalOpen(true);
  };

  const openEdit = (record: User) => {
    setEditing(record);
    form.setFieldsValue({
      nickName: record.nickName,
      avatarUrl: record.avatarUrl,
      role: record.role,
      shopId: record.shopId,
    });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);

      if (editing) {
        const isSelf = editing.id === currentUser?.id;
        if (isSelf && !isPlatformAdmin) {
          // 本人非平台管理员：只能改昵称头像
          await updateMe({
            nickName: values.nickName,
            avatarUrl: values.avatarUrl,
          });
          // 同步顶栏名称
          await setInitialState((s: any) => ({
            ...s,
            currentUser: s?.currentUser
              ? { ...s.currentUser, name: values.nickName || s.currentUser.name }
              : s?.currentUser,
          }));
        } else if (isPlatformAdmin) {
          await updateUser(editing.id, {
            nickName: values.nickName,
            avatarUrl: values.avatarUrl,
            role: values.role,
            shopId: values.role === 'admin' ? values.shopId || null : values.shopId || null,
          });
        } else {
          message.warning('无权修改该用户');
          return;
        }
        message.success('用户已更新');
      } else {
        if (!isPlatformAdmin) {
          message.warning('仅平台管理员可创建用户');
          return;
        }
        if (values.role === 'merchant' && !values.shopId) {
          message.warning('商家账号必须绑定店铺');
          return;
        }
        await createUser({
          nickName: values.nickName,
          role: values.role,
          shopId: values.shopId || undefined,
          avatarUrl: values.avatarUrl,
          openid: values.openid || undefined,
        });
        message.success('用户创建成功');
      }
      setModalOpen(false);
      loadUsers();
    } catch (error) {
      if ((error as { errorFields?: unknown })?.errorFields) return;
      console.error('保存用户失败:', error);
    } finally {
      setSubmitting(false);
    }
  };

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
              {record.id === currentUser?.id ? (
                <Tag style={{ marginLeft: 6 }} color="orange">
                  我
                </Tag>
              ) : null}
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
      width: 120,
      render: (role: string, record: User) => {
        const text = resolveRoleLabel(role, record.shopId);
        const color = roleMap[role]?.color || 'default';
        return <Tag color={color}>{text}</Tag>;
      },
    },
    {
      title: '所属店铺',
      dataIndex: 'shopId',
      key: 'shopId',
      width: 160,
      ellipsis: true,
      render: (shopId?: string) => {
        if (!shopId) return <Text type="secondary">—</Text>;
        const name = shopNameMap.get(shopId);
        return name ? (
          <Text>{name}</Text>
        ) : (
          <Text copyable={{ text: shopId }} style={{ fontFamily: 'monospace', fontSize: 12 }}>
            {shopId.slice(0, 8)}…
          </Text>
        );
      },
    },
    {
      title: 'OpenID',
      dataIndex: 'openid',
      key: 'openid',
      width: 160,
      render: (openid?: string) => (
        <Text type="secondary" style={{ fontFamily: 'monospace', fontSize: 12 }}>
          {maskOpenid(openid)}
        </Text>
      ),
    },
    {
      title: '注册时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      render: (time: string) => formatTime(time, 'YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      fixed: 'right' as const,
      render: (_: unknown, record: User) => {
        const canEdit = isPlatformAdmin || record.id === currentUser?.id;
        if (!canEdit) return <Text type="secondary">—</Text>;
        return (
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(record)}>
            编辑
          </Button>
        );
      },
    },
  ];

  return (
    <div className="tf-page">
      <PageHeaderActions
        icon={<TeamOutlined style={{ marginRight: 8 }} />}
        title="用户管理"
        addText={isPlatformAdmin ? '新建用户' : undefined}
        onAdd={isPlatformAdmin ? openCreate : undefined}
        onRefresh={loadUsers}
        extra={
          !isPlatformAdmin ? (
            <Button icon={<EditOutlined />} onClick={() => {
              const me = users.find((u) => u.id === currentUser?.id);
              if (me) openEdit(me);
              else message.info('请刷新后重试');
            }}>
              编辑我的资料
            </Button>
          ) : undefined
        }
      />

      <TableCard>
        <SearchFilterBar
          searchPlaceholder="搜索昵称 / ID / OpenID"
          onSearch={setSearchText}
          onSearchClear={() => setSearchText('')}
          filterPlaceholder="按角色筛选"
          filterValue={roleFilter}
          filterOptions={[
            { label: '顾客', value: 'customer' },
            { label: '商家', value: 'merchant' },
            { label: '平台管理员', value: 'admin' },
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
          pagination={DEFAULT_TABLE_PAGINATION}
          locale={DEFAULT_TABLE_LOCALE}
          scroll={{ x: 1000 }}
        />
      </TableCard>

      <Modal
        title={editing ? '编辑用户' : '新建用户'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        confirmLoading={submitting}
        okText="保存"
        destroyOnClose
        width={520}
      >
        <Form form={form} layout="vertical" initialValues={{ role: 'customer', accountType: 'merchant' }}>
          <Form.Item
            name="nickName"
            label="昵称"
            rules={[
              { required: true, message: '请输入昵称' },
              { max: 32, message: '不超过 32 字' },
            ]}
          >
            <Input placeholder="用户显示名称" />
          </Form.Item>
          <Form.Item name="avatarUrl" label="头像 URL">
            <Input placeholder="https://..." />
          </Form.Item>

          {/* 创建时：平台管理员可选角色 */}
          {!editing && isPlatformAdmin ? (
            <>
              <Form.Item
                name="role"
                label="角色"
                rules={[{ required: true, message: '请选择角色' }]}
              >
                <Select
                  options={[
                    { label: '顾客', value: 'customer' },
                    { label: '商家', value: 'merchant' },
                    { label: '平台管理员', value: 'admin' },
                    { label: '骑手', value: 'rider' },
                  ]}
                />
              </Form.Item>
              {watchRole === 'merchant' || watchRole === 'rider' ? (
                <Form.Item
                  name="shopId"
                  label="绑定店铺"
                  rules={
                    watchRole === 'merchant'
                      ? [{ required: true, message: '商家必须绑定店铺' }]
                      : undefined
                  }
                >
                  <Select
                    allowClear={watchRole !== 'merchant'}
                    placeholder="选择店铺"
                    options={shops.map((s) => ({ label: s.name, value: s.id }))}
                    showSearch
                    optionFilterProp="label"
                  />
                </Form.Item>
              ) : null}
              <Form.Item name="openid" label="OpenID（可选）">
                <Input placeholder="不填则自动生成，开发环境可用 mock code 登录" />
              </Form.Item>
            </>
          ) : null}

          {/* 编辑时：平台管理员可改角色/店铺 */}
          {editing && isPlatformAdmin ? (
            <>
              <Form.Item name="role" label="角色" rules={[{ required: true }]}>
                <Select
                  options={[
                    { label: '顾客', value: 'customer' },
                    { label: '商家', value: 'merchant' },
                    { label: '平台管理员', value: 'admin' },
                    { label: '骑手', value: 'rider' },
                  ]}
                />
              </Form.Item>
              <Form.Item
                name="shopId"
                label="绑定店铺"
                extra="商家必须绑定店铺；平台管理员请留空"
              >
                <Select
                  allowClear
                  placeholder="留空 = 平台管理员 / 无绑定"
                  options={shops.map((s) => ({ label: s.name, value: s.id }))}
                  showSearch
                  optionFilterProp="label"
                />
              </Form.Item>
            </>
          ) : null}
        </Form>
      </Modal>
    </div>
  );
};

export default UserPage;
