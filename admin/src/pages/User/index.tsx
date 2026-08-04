import React, { useState, useMemo, useEffect } from 'react';
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
  Tooltip,
} from 'antd';
import { antdMessage as message } from '@/utils/antdApp';
import { UserOutlined, TeamOutlined, EditOutlined, EyeOutlined } from '@ant-design/icons';
import { useModel } from '@umijs/max';
import { User, GetUsersParams } from '@/services/user';
import {
  useUsers,
  useUserProfile,
  useShops,
  useCreateUser,
  useUpdateUser,
  useUpdateMe,
} from '@/hooks/queries';
import SearchFilterBar from '@/components/SearchFilterBar';
import { formatTime, shortOrderId } from '@/utils/format';
import PageHeaderActions from '@/components/PageHeaderActions';
import TableCard from '@/components/TableCard';
import {
  DEFAULT_PAGE_SIZE,
  DEFAULT_TABLE_PAGINATION,
  DEFAULT_TABLE_LOCALE,
} from '@/utils/table';
import { brand } from '@/theme';
import UserProfileDrawer from './components/UserProfileDrawer';

const { Text } = Typography;

const roleMap: Record<string, { color: string; text: string }> = {
  customer: { color: 'blue', text: '顾客' },
  admin: { color: 'red', text: '平台管理员' },
  merchant: { color: 'orange', text: '商家' },
  rider: { color: 'green', text: '骑手' },
};

const statusMap: Record<string, { color: string; text: string }> = {
  active: { color: 'green', text: '正常' },
  disabled: { color: 'red', text: '已禁用' },
  banned: { color: 'volcano', text: '已拉黑' },
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

  const [searchText, setSearchText] = useState('');
  const [roleFilter, setRoleFilter] = useState<string | undefined>();
  const [statusFilter, setStatusFilter] = useState<string | undefined>(); // T312.5
  const [rangeFilter, setRangeFilter] = useState<number | undefined>();  // T312.5
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [drawerUserId, setDrawerUserId] = useState<string | null>(null); // §3.24
  const [form] = Form.useForm();
  const watchRole = Form.useWatch('role', form);

  useEffect(() => {
    setPage(1);
  }, [searchText, roleFilter, statusFilter, rangeFilter]);

  const userListParams: GetUsersParams = useMemo(
    () => ({
      page,
      pageSize,
      role: roleFilter,
      keyword: searchText,
      status: statusFilter,
      registeredWithinDays: rangeFilter,
    }),
    [page, pageSize, roleFilter, searchText, statusFilter, rangeFilter],
  );

  const usersQuery = useUsers(userListParams);
  const loading = usersQuery.isPending;
  const total = usersQuery.data?.total ?? 0;
  const users = useMemo<User[]>(
    () =>
      (usersQuery.data?.items || []).map((u: any) => ({
        ...u,
        createdAt: u.createdAt || u.registerDate || '',
        shopId: u.shopId,
      })),
    [usersQuery.data],
  );

  // 用户画像（抽屉数据源）
  const profileQuery = useUserProfile(drawerUserId || undefined);
  const profile = profileQuery.data;
  const profileLoading = profileQuery.isPending;

  // 店铺列表只用于平台管理员的绑定选择
  const shopsQuery = useShops({ enabled: isPlatformAdmin });
  const shops = shopsQuery.data ?? [];

  const createUserMutation = useCreateUser();
  const updateUserMutation = useUpdateUser();
  const updateMeMutation = useUpdateMe();
  const submitting =
    createUserMutation.isPending || updateUserMutation.isPending || updateMeMutation.isPending;

  const shopNameMap = useMemo(() => {
    const map = new Map<string, string>();
    shops.forEach((s) => map.set(s.id, s.name));
    return map;
  }, [shops]);

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

  // 打开详情抽屉（§3.24 / T312.1）
  const openDrawer = (record: User) => {
    setDrawerUserId(record.id);
  };

  const closeDrawer = () => {
    setDrawerUserId(null);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      if (editing) {
        const isSelf = editing.id === currentUser?.id;
        if (isSelf && !isPlatformAdmin) {
          // 本人非平台管理员：只能改昵称头像
          await updateMeMutation.mutateAsync({
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
          await updateUserMutation.mutateAsync({
            id: editing.id,
            data: {
              nickName: values.nickName,
              avatarUrl: values.avatarUrl,
              role: values.role,
              shopId: values.shopId || null,
            },
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
        await createUserMutation.mutateAsync({
          nickName: values.nickName,
          role: values.role,
          shopId: values.shopId || undefined,
          avatarUrl: values.avatarUrl,
          openid: values.openid || undefined,
        });
        message.success('用户创建成功');
      }
      setModalOpen(false);
    } catch (error) {
      if ((error as { errorFields?: unknown })?.errorFields) return;
      console.error('保存用户失败:', error);
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
                <Tag style={{ marginLeft: 'var(--tf-space-1_5)'}} color="orange">
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
      width: 100,
      render: (role: string, record: User) => {
        const text = resolveRoleLabel(role, record.shopId);
        const color = roleMap[role]?.color || 'default';
        return <Tag color={color}>{text}</Tag>;
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: (status?: string) => {
        const info = statusMap[status || 'active'] || statusMap.active;
        return <Tag color={info.color}>{info.text}</Tag>;
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
      title: '手机号',
      dataIndex: 'phone',
      key: 'phone',
      width: 130,
      render: (phone?: string) =>
        phone ? (
          <Text style={{ fontFamily: 'monospace', fontSize: 12 }} copyable={{ text: phone }}>
            {phone.replace(/^(\d{3})\d{4}(\d{4})$/, '$1****$2')}
          </Text>
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
    {
      title: '注册时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 150,
      render: (time: string) => formatTime(time, 'YYYY-MM-DD HH:mm'),
    },
    {
      title: '最后登录',
      dataIndex: 'lastLoginAt',
      key: 'lastLoginAt',
      width: 150,
      render: (time?: string) =>
        time ? formatTime(time, 'YYYY-MM-DD HH:mm') : <Text type="secondary">—</Text>,
    },
    {
      title: '操作',
      key: 'action',
      width: 140,
      fixed: 'right' as const,
      render: (_: unknown, record: User) => {
        const canEdit = isPlatformAdmin || record.id === currentUser?.id;
        return (
          <Space size={4} split={<Text type="secondary">|</Text>}>
            <Tooltip title="查看用户详情 / 画像">
              <Button
                type="link"
                size="small"
                icon={<EyeOutlined />}
                onClick={() => openDrawer(record)}
              >
                详情
              </Button>
            </Tooltip>
            {canEdit ? (
              <Button
                type="link"
                size="small"
                icon={<EditOutlined />}
                onClick={() => openEdit(record)}
              >
                编辑
              </Button>
            ) : (
              <Text type="secondary">—</Text>
            )}
          </Space>
        );
      },
    },
  ];

  // 当前打开抽屉的用户的店铺名（用于画像卡显示）
  const drawerShopName = useMemo(() => {
    if (!profile?.shopId) return undefined;
    return shopNameMap.get(profile.shopId);
  }, [profile?.shopId, shopNameMap]);

  return (
    <div className="tf-page">
      <PageHeaderActions
        icon={<TeamOutlined style={{ marginRight: 'var(--tf-space-2)' }} />}
        title={isPlatformAdmin ? '用户管理' : '顾客管理'}
        addText={isPlatformAdmin ? '新建用户' : undefined}
        onAdd={isPlatformAdmin ? openCreate : undefined}
        onRefresh={() => usersQuery.refetch()}
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
          searchPlaceholder="搜索昵称 / ID / OpenID / 手机号"
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
          filter2Placeholder="状态"
          filter2Value={statusFilter}
          filter2Options={[
            { label: '正常', value: 'active' },
            { label: '已禁用', value: 'disabled' },
            { label: '已拉黑', value: 'banned' },
          ]}
          onFilter2Change={setStatusFilter}
          extra={
            <Select
              allowClear
              placeholder="注册时间"
              value={rangeFilter ? String(rangeFilter) : undefined}
              onChange={(v?: string) => setRangeFilter(v ? Number(v) : undefined)}
              options={[
                { label: '最近 7 天', value: '7' },
                { label: '最近 30 天', value: '30' },
                { label: '最近 90 天', value: '90' },
              ]}
              style={{ width: 130 }}
            />
          }
        />
        <Table
          columns={columns}
          dataSource={users}
          rowKey="id"
          loading={loading}
          size="small"
          pagination={{
            ...DEFAULT_TABLE_PAGINATION,
            current: page,
            total,
            pageSize,
            onChange: (p: number, ps: number) => {
              setPage(p);
              setPageSize(ps);
            },
          }}
          locale={DEFAULT_TABLE_LOCALE}
          scroll={{ x: 1240 }}
          onRow={(record) => ({
            onClick: () => openDrawer(record),
            style: { cursor: 'pointer' },
          })}
        />
      </TableCard>

      <Modal
        title={editing ? '编辑用户' : '新建用户'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        confirmLoading={submitting}
        okText="保存"
        destroyOnHidden
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

      <UserProfileDrawer
        userId={drawerUserId || undefined}
        open={!!drawerUserId}
        onClose={closeDrawer}
        profile={profile}
        loading={profileLoading}
        shopName={drawerShopName}
      />
    </div>
  );
};

export default UserPage;
