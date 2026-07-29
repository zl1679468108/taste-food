import React, { useEffect, useState } from 'react';
import {
  Alert,
  Form,
  Input,
  Modal,
  Radio,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import { FormOutlined } from '@ant-design/icons';
import { useLocation } from '@umijs/max';
import { useQueryClient } from '@tanstack/react-query';
import {
  checkRoleApplicationEligibility,
  type RoleApplication,
  type ApplyRole,
  type RoleApplicationEligibility,
} from '@/services/role-application';
import {
  useMyApplications,
  useCreateRoleApplication,
  useRoleApplicationEligibility,
} from '@/hooks/queries';
import { queryKeys } from '@/hooks/queries/queryKeys';
import { formatTime } from '@/utils/format';
import { DEFAULT_TABLE_LOCALE, DEFAULT_TABLE_PAGINATION, DEFAULT_TABLE_SIZE } from '@/utils/table';
import TableCard from '@/components/TableCard';
import PageHeaderActions from '@/components/PageHeaderActions';
import { brand } from '@/theme';

const { Text } = Typography;

const statusMap: Record<string, { color: string; text: string }> = {
  pending: { color: 'processing', text: '待审批' },
  approved: { color: 'success', text: '已通过' },
  rejected: { color: 'error', text: '已驳回' },
};

const roleMap: Record<string, string> = {
  merchant: '商家',
  rider: '骑手',
};

function useQueryIntent(): ApplyRole | undefined {
  const location = useLocation();
  const params = new URLSearchParams(location.search || '');
  const intent = params.get('intent');
  if (intent === 'merchant' || intent === 'rider') return intent;
  return undefined;
}

const ApplicationsPage: React.FC = () => {
  const intent = useQueryIntent();
  const qc = useQueryClient();
  const [open, setOpen] = useState(!!intent);
  const [form] = Form.useForm();
  const applyRole = Form.useWatch('applyRole', form) as ApplyRole | undefined;
  const shopName = Form.useWatch('shopName', form) as string | undefined;
  // 店铺名逐字输入会打请求，防抖后才参与 query key
  const [debouncedShopName, setDebouncedShopName] = useState<string | undefined>();

  const myApplicationsQuery = useMyApplications();
  const list = myApplicationsQuery.data ?? [];
  const loading = myApplicationsQuery.isPending;

  const createMutation = useCreateRoleApplication();
  const submitting = createMutation.isPending;

  const eligibilityQuery = useRoleApplicationEligibility(
    open ? applyRole : undefined,
    debouncedShopName,
  );
  const eligibility: RoleApplicationEligibility | null = eligibilityQuery.data ?? null;

  useEffect(() => {
    if (intent) {
      form.setFieldsValue({ applyRole: intent });
      setOpen(true);
    }
  }, [intent, form]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedShopName(shopName), 350);
    return () => window.clearTimeout(timer);
  }, [shopName]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      // 提交前用最新数据再校验一次，避免读到缓存里的过期结论
      const normalizedName =
        values.applyRole === 'merchant' ? (values.shopName as string)?.trim() || undefined : undefined;
      const checked = await qc.fetchQuery({
        queryKey: queryKeys.roleApplications.eligibility(values.applyRole, normalizedName),
        queryFn: () => checkRoleApplicationEligibility(values.applyRole, normalizedName),
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
    }
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
          <div>{row.shopName || '—'}</div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {row.contactName || ''} {row.contactPhone || row.shopPhone || ''}
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
    <div className="tf-page">
      <PageHeaderActions
        icon={<FormOutlined style={{ marginRight: 8 }} />}
        title="我的申请"
        onRefresh={() => void myApplicationsQuery.refetch()}
        addText="提交申请"
        onAdd={() => {
          form.resetFields();
          setDebouncedShopName(undefined);
          form.setFieldsValue({ applyRole: intent || 'merchant' });
          setOpen(true);
        }}
      />

      <TableCard
        title="身份申请记录"
        extra={<Text type="secondary">申请商家或骑手身份，等待平台管理员审批</Text>}
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
      </TableCard>

      <Modal
        title="提交身份申请"
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => void handleSubmit()}
        confirmLoading={submitting}
        okButtonProps={{ disabled: eligibility?.eligible === false }}
        destroyOnClose
        width={560}
      >
        <Form form={form} layout="vertical" initialValues={{ applyRole: 'merchant' }}>
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
    </div>
  );
};

export default ApplicationsPage;
