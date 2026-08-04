import React from 'react';
import { Typography, Tag, Empty, Space, Divider, Button } from 'antd';
import { SwapOutlined, UserOutlined, FormOutlined, ShopOutlined, PhoneOutlined, SafetyCertificateOutlined, PlusOutlined } from '@ant-design/icons';
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

const roleColor: Record<string, string> = {
  admin: 'red',
  merchant: 'orange',
  rider: 'blue',
  customer: 'default',
};

/** 截断 UUID：只显示前 8 和后 4 位 */
function truncateId(id?: string | null): string {
  if (!id || id.length <= 16) return id || '—';
  return `${id.slice(0, 8)}…${id.slice(-4)}`;
}

// ═══════════════════════════════════════════════════════════
// 卡片 1：账号信息（重新设计）
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
    <div className="account-profile-grid">
      {/* ── 左侧：个人信息卡片 ── */}
      <div className="account-profile-main">
        <TableCard style={{ height: '100%' }} bodyStyle={{ padding: 0 }}>
          {/* 头部区域：渐变背景 + 头像信息 */}
          <div className="profile-header">
            <div className="profile-header-bg" />
            <div className="profile-avatar-wrap">
              <Avatar
                size={64}
                icon={<UserOutlined />}
                className="profile-avatar"
              />
              <div className="profile-badge">
                <Tag color={roleColor[role] || 'default'} className="profile-role-tag">
                  {roleLabel[role] || role}
                </Tag>
              </div>
            </div>
            <div className="profile-name-section">
              <Title level={4} className="profile-name">
                {user?.name || '用户'}
              </Title>
              <Text type="secondary" className="profile-id">
                ID: {truncateId(user?.id)}
              </Text>
            </div>
          </div>

          <Divider style={{ margin: 0 }} />

          {/* 信息网格 */}
          <div className="profile-info-grid">
            <div className="profile-info-item">
              <div className="info-label">
                <ShopOutlined className="info-icon" />
                <span>绑定店铺</span>
              </div>
              <div className="info-value">
                <Text strong>{truncateId(user?.shopId) || '未绑定'}</Text>
              </div>
            </div>
            <div className="profile-info-item">
              <div className="info-label">
                <PhoneOutlined className="info-icon" />
                <span>手机号</span>
              </div>
              <div className="info-value">
                <Text strong>{user?.phone || '未设置'}</Text>
              </div>
            </div>
            <div className="profile-info-item profile-info-item--full">
              <div className="info-label">
                <SafetyCertificateOutlined className="info-icon" />
                <span>可用角色</span>
              </div>
              <div className="info-value">
                {roles.length > 0 ? (
                  <Space wrap size={6}>
                    {roles.map((r: API.UserRoleItem) => (
                      <Tag key={`${r.role}-${r.shopId || ''}`} color={roleColor[r.role] || 'default'}>
                        {roleLabel[r.role] || r.role}
                        {r.shopId ? `(店铺)` : ''}
                      </Tag>
                    ))}
                  </Space>
                ) : (
                  <Tag color={roleColor[role]}>{roleLabel[role]}</Tag>
                )}
              </div>
            </div>
          </div>
        </TableCard>
      </div>

      {/* ── 右侧：角色切换卡片（紧凑）── */}
      <div className="account-profile-side">
        <TableCard
          title={
            <Space size={8}>
              <SwapOutlined style={{ color: brand.primary }} />
              <span>角色切换</span>
            </Space>
          }
          style={{ height: '100%' }}
        >
          {canSwitchRole ? (
            <RoleSwitcher />
          ) : (
            <div className="role-empty-hint">
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  <Text type="secondary" style={{ fontSize: 13 }}>
                    当前仅有一个角色
                    <br />
                    <a onClick={() => document.querySelector('.apply-btn')?.scrollIntoView({ behavior: 'smooth' })}>
                      前往申请 →
                    </a>
                  </Text>
                }
              />
            </div>
          )}
        </TableCard>
      </div>
    </div>
  );
};

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

  const emptyState = (
    <div className="apply-empty">
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={
          <span className="apply-empty__tips">还没有申请记录，提交身份申请等待管理员审批</span>
        }
      />
      <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>
        提交身份申请
      </Button>
    </div>
  );

  return (
    <TableCard
      title={
        <Space size={8}>
          <FormOutlined style={{ color: brand.primary }} />
          <span>我的申请</span>
        </Space>
      }
      extra={
        <Button
          type="primary"
          size="small"
          icon={<PlusOutlined />}
          onClick={() => setOpen(true)}
        >
          提交申请
        </Button>
      }
      style={{ marginTop: brand.space4 }}
      className="apply-btn"
    >
      <Table
        rowKey="id"
        loading={loading}
        dataSource={list}
        columns={columns}
        size={DEFAULT_TABLE_SIZE}
        pagination={DEFAULT_TABLE_PAGINATION}
        locale={{ ...DEFAULT_TABLE_LOCALE, emptyText: emptyState }}
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
// 主页面：个人中心
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
