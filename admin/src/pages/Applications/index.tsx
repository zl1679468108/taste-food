import React, { useCallback, useEffect, useState } from 'react';
import {
  Button,
  Card,
  Form,
  Input,
  Modal,
  Radio,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { useLocation } from '@umijs/max';
import {
  createRoleApplication,
  listMyApplications,
  type RoleApplication,
  type ApplyRole,
} from '@/services/role-application';
import { formatTime } from '@/utils/format';
import { DEFAULT_TABLE_LOCALE, DEFAULT_TABLE_PAGINATION } from '@/utils/table';
import TableCard from '@/components/TableCard';

const { Title, Text } = Typography;

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
  const [list, setList] = useState<RoleApplication[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(!!intent);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();
  const applyRole = Form.useWatch('applyRole', form);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await listMyApplications();
      setList(Array.isArray(rows) ? rows : []);
    } catch {
      setList([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (intent) {
      form.setFieldsValue({ applyRole: intent });
      setOpen(true);
    }
  }, [intent, form]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      await createRoleApplication({
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
      await load();
    } catch {
      // validation or interceptor
    } finally {
      setSubmitting(false);
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
    <div>
      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>
            我的申请
          </Title>
          <Text type="secondary">申请商家或骑手身份，等待平台管理员审批</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => void load()}>
            刷新
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              form.resetFields();
              form.setFieldsValue({ applyRole: intent || 'merchant' });
              setOpen(true);
            }}
          >
            提交申请
          </Button>
        </Space>
      </Space>

      <TableCard>
        <Table
          rowKey="id"
          loading={loading}
          dataSource={list}
          columns={columns}
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
        destroyOnClose
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
