import React from 'react';
import { Typography, Descriptions, Tag, Empty, Space } from 'antd';
import { SwapOutlined, UserOutlined, FormOutlined } from '@ant-design/icons';
import { useModel } from '@umijs/max';
import { useQueryClient } from '@tanstack/react-query';
import {
  useMyApplications,
  useCreateRoleApplication,
  useRoleApplicationEligibility,
} from '@/hooks/queries';
import { queryKeys } from '@/hooks/queries/queryKeys';
import {
  checkRoleApplicationEligibility,
  type RoleApplication,
  type ApplyRole,
  type RoleApplicationEligibility,
} from '@/services/role-application';
import { formatTime } from '@/utils/format';
import {
  DEFAULT_TABLE_LOCALE,
  DEFAULT_TABLE_PAGINATION,
  DEFAULT_TABLE_SIZE,
} from '@/utils/table';
import { brand } from '@/theme';
import RoleSwitcher from '@/components/RoleSwitcher';
import PageHeaderActions from '@/components/PageHeaderActions';
import TableCard from '@/components/TableCard';
import { Avatar, Row, Col, Form, Input, Radio, Alert, Table, Modal } from 'antd';
import { antdMessage as message } from '@/utils/antdApp';

const { Title, Text } = Typography;

// ── 角色标签映射 ──────────────────────────────────────────
const roleLabel: Record<string, string> = {
  admin: '平台管理员',
  merchant: '商家',
  rider: '骑手',
  customer: '顾客',
};

// ═══════════════════════════════════════════════════════════
// 卡片 1：账号信息
// ═══════════════════════════════════════════════════════════
const AccountInfoCard: React.FC = () => {
  const { initialState } = useModel('@@initialState');
  const user = initialState?.currentUser;
  const roles = user?.roles || [];
  const role = user?.role || 'customer';
  const canSwitchRole =
    roles.length > 1 ||
    role !== 'customer' ||
    (roles.length === 1 && roles[0].role !== role);

  return (
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
                children: roles.length > 0 ? (
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
  );
};

// 消息中心已统一由顶栏铃铛入口承载（components/NotificationBell），
// 点击「查看全部」进入独立的 /messages 消息中心页面，个人中心不再重复展示。

// ═══════════════════════════════════════════════════════════
// 卡片 2：我的申请
// ═══════════════════════════════════════════════════════════
const ApplicationsCard: React.FC = () => {
  const qc = useQueryClient();
  const [open, setOpen] = React.useState(false);
  const [form] = Form.useForm();
  const applyRole = Form.useWatch('applyRole', form) as ApplyRole | undefined;
  const shopName = Form.useWatch('shopName', form) as string | undefined;
  const [debouncedShopName, setDebouncedShopName] = React.useState<string | undefined>();
  const [localSubmitting, setLocalSubmitting] = React.useState(false);

  const myApplicationsQuery = useMyApplications();
  const list = myApplicationsQuery.data ?? [];
  const loading = myApplicationsQuery.isPending;
  const createMutation = useCreateRoleApplication();
  const submitting = localSubmitting || createMutation.isPending;

  const eligibilityQuery = useRoleApplicationEligibility(
    open ? applyRole : undefined,
    debouncedShopName,
  );
  const eligibility: RoleApplicationEligibility | null = eligibilityQuery.data ?? null;

  React.useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedShopName(shopName), 350);
    return () => window.clearTimeout(timer);
  }, [shopName]);

  React.useEffect(() => {
    if (applyRole === 'merchant') {
      // trigger eligibility
    }
  }, [applyRole]);

  const handleSubmit = async () => {
    if (submitting) return;
    setLocalSubmitting(true);
    try {
      const values = await form.validateFields();
      const normalizedName =
        values.applyRole === 'merchant'
          ? (values.shopName as string)?.trim() || undefined
          : undefined;
      const checked = await qc.fetchQuery({
        queryKey: queryKeys.roleApplications.eligibility(
          values.applyRole,
          normalizedName,
        ),
        queryFn: () =>
          checkRoleApplicationEligibility(values.applyRole, normalizedName),
        staleTime: 0,
      });
      if (!checked.eligible) {
        message.warning(checked.reason || '当前不可提交申请');
        return;
      }
      await createMutation.mutateAsync({
        applyRole: values.applyRole,
        shopName: values.shopName,
        shopAddress: values.shopAddress,
        shopPhone: values.shopPhone,
        contactName: values.contactName,
        contactPhone: values.contactPhone,
      });
      message.success('申请已提交');
      setOpen(false);
      form.resetFields();
    } catch {
      // validation or interceptor
    } finally {
      setLocalSubmitting(false);
    }
  };

  const statusMap: Record<string, { color: string; text: string }> = {
    pending: { color: 'processing', text: '待审批' },
    approved: { color: 'success', text: '已通过' },
    rejected: { color: 'error', text: '已驳回' },
  };

  const roleMap: Record<string, string> = {
    merchant: '商家',
    rider: '骑手',
  };

  const columns = [
    {
      title: '申请角色',
      dataIndex: 'applyRole',
      width: 100,
      render: (v: string) => roleMap[v] || v,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (v: string) => {
        const m = statusMap[v] || { color: 'default', text: v };
        return <Tag color={m.color}>{m.text}</Tag>;
      },
    },
    {
      title: '店铺/联系',
      key: 'info',
      render: (_: unknown, row: RoleApplication) => (
        <div>
          <div>{(row as any).shopName || '—'}</div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {(row as any).contactName || ''} {(row as any).contactPhone || (row as any).shopPhone || ''}
          </Text>
        </div>
      ),
    },
    {
      title: '驳回原因',
      dataIndex: 'rejectReason',
      render: (v?: string) => v || '—',
    },
    {
      title: '提交时间',
      dataIndex: 'createdAt',
      width: 170,
      render: (v: string) => formatTime(v),
    },
  ];

  return (
    <TableCard
      title={
        <Space>
          <FormOutlined />
          <span>我的申请</span>
        </Space>
      }
      extra={<Text type="secondary">申请商家或骑手身份，等待平台管理员审批</Text>}
      style={{ marginTop: brand.space4 }}
    >
      <Table
        rowKey="id"
        loading={loading}
        dataSource={list}
        columns={columns}
        size={DEFAULT_TABLE_SIZE}
        pagination={DEFAULT_TABLE_PAGINATION}
        locale={DEFAULT_TABLE_LOCALE}
      />

      <Modal
        title="提交身份申请"
        open={open}
        onCancel={() => {
          if (submitting) return;
          setOpen(false);
        }}
        onOk={() => void handleSubmit()}
        confirmLoading={submitting}
        okButtonProps={{
          disabled: eligibility?.eligible === false || submitting,
        }}
        cancelButtonProps={{ disabled: submitting }}
        destroyOnHidden
        width={560}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{ applyRole: 'merchant' }}
        >
          <Form.Item
            name="applyRole"
            label="申请角色"
            rules={[{ required: true, message: '请选择角色' }]}
          >
            <Radio.Group>
              <Radio value="merchant">商家</Radio>
              <Radio value="rider">骑手</Radio>
            </Radio.Group>
          </Form.Item>
          {eligibility && !eligibility.eligible && (
            <Alert
              type="warning"
              showIcon
              message={eligibility.reason || '当前不可提交申请'}
              style={{ marginBottom: brand.space4 }}
            />
          )}
          {applyRole === 'merchant' && (
            <>
              <Form.Item
                name="shopName"
                label="店铺名称"
                rules={[{ required: true, message: '请填写店铺名称' }]}
              >
                <Input placeholder="如：小买卖总店" />
              </Form.Item>
              <Form.Item name="shopAddress" label="店铺地址">
                <Input placeholder="选填" />
              </Form.Item>
              <Form.Item name="shopPhone" label="店铺电话">
                <Input placeholder="选填" />
              </Form.Item>
            </>
          )}
          <Form.Item name="contactName" label="联系人">
            <Input placeholder="选填" />
          </Form.Item>
          <Form.Item name="contactPhone" label="联系电话">
            <Input placeholder="选填" />
          </Form.Item>
        </Form>
      </Modal>
    </TableCard>
  );
};

// ═══════════════════════════════════════════════════════════
// 主页面：个人中心（两卡片纵向排列）
// ═══════════════════════════════════════════════════════════
const AccountPage: React.FC = () => {
  return (
    <div className="tf-page">
      <PageHeaderActions
        icon={<UserOutlined style={{ marginRight: 'var(--tf-space-2)'}} />}
        title="个人中心"
      />
      <AccountInfoCard />
      <ApplicationsCard />
    </div>
  );
};

export default AccountPage;
