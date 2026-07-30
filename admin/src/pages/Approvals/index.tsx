import React, { useState } from 'react';
import {
  Button,
  Form,
  Input,
  Modal,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import { CheckOutlined, CloseOutlined, ReloadOutlined } from '@ant-design/icons';
import { type RoleApplication } from '@/services/role-application';
import { useApplications, useReviewApplication } from '@/hooks/queries';
import { formatTime } from '@/utils/format';
import { DEFAULT_TABLE_LOCALE, DEFAULT_TABLE_PAGINATION } from '@/utils/table';
import TableCard from '@/components/TableCard';
import SearchFilterBar from '@/components/SearchFilterBar';
import { isRequestErrorHandled } from '@/utils/request';

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

const ApprovalsPage: React.FC = () => {
  const [status, setStatus] = useState<string | undefined>('pending');
  const [rejectOpen, setRejectOpen] = useState(false);
  const [current, setCurrent] = useState<RoleApplication | null>(null);
  const [form] = Form.useForm();

  const applicationsQuery = useApplications(status);
  const list = applicationsQuery.data ?? [];
  const loading = applicationsQuery.isPending;

  const reviewMutation = useReviewApplication();
  const submitting = reviewMutation.isPending;
  /** 正在审批的申请 id：只锁当前行，其余行保持可用 */
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  const handleApprove = (row: RoleApplication) => {
    if (submitting) return;
    Modal.confirm({
      title: '确认通过该申请？',
      content:
        row.applyRole === 'merchant'
          ? `将创建/绑定商家店铺：${row.shopName || '未命名'}`
          : '将为用户开通骑手角色',
      okText: '通过',
      // 返回 Promise，antd 会自动给确认按钮加 loading 并阻止重复点击
      onOk: async () => {
        setReviewingId(row.id);
        try {
          await reviewMutation.mutateAsync({ id: row.id, params: { status: 'approved' } });
          message.success('已通过');
        } catch (error) {
          // 重复提交被请求层拦截，不视为失败
          if (isRequestErrorHandled(error)) return;
          throw error;
        } finally {
          setReviewingId(null);
        }
      },
    });
  };

  const openReject = (row: RoleApplication) => {
    setCurrent(row);
    form.resetFields();
    setRejectOpen(true);
  };

  const handleReject = async () => {
    try {
      const values = await form.validateFields();
      if (!current) return;
      await reviewMutation.mutateAsync({
        id: current.id,
        params: {
          status: 'rejected',
          rejectReason: values.rejectReason,
        },
      });
      message.success('已驳回');
      setRejectOpen(false);
      setCurrent(null);
    } catch {
      // validation / toast
    }
  };

  const columns = [
    {
      title: '申请角色',
      dataIndex: 'applyRole',
      width: 90,
      render: (v: string) => roleMap[v] || v,
    },
    {
      title: '用户 ID',
      dataIndex: 'userId',
      width: 160,
      ellipsis: true,
      render: (v: string) => (
        <Text copyable={{ text: v }} style={{ fontSize: 12 }}>
          {v ? `${v.slice(0, 8)}…` : '—'}
        </Text>
      ),
    },
    {
      title: '店铺信息',
      key: 'shop',
      render: (_: unknown, row: RoleApplication) => (
        <div>
          <div>{row.shopName || '—'}</div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {row.shopAddress || ''}
          </Text>
        </div>
      ),
    },
    {
      title: '联系人',
      key: 'contact',
      width: 140,
      render: (_: unknown, row: RoleApplication) =>
        `${row.contactName || ''} ${row.contactPhone || row.shopPhone || ''}`.trim() || '—',
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
      title: '驳回原因',
      dataIndex: 'rejectReason',
      ellipsis: true,
      render: (v?: string) => v || '—',
    },
    {
      title: '提交时间',
      dataIndex: 'createdAt',
      width: 170,
      render: (v: string) => formatTime(v),
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      fixed: 'right' as const,
      render: (_: unknown, row: RoleApplication) =>
        row.status === 'pending' ? (
          <Space>
            <Button
              type="link"
              size="small"
              icon={<CheckOutlined />}
              loading={reviewingId === row.id}
              disabled={submitting}
              onClick={() => handleApprove(row)}
            >
              通过
            </Button>
            <Button
              type="link"
              size="small"
              danger
              icon={<CloseOutlined />}
              disabled={submitting}
              onClick={() => openReject(row)}
            >
              驳回
            </Button>
          </Space>
        ) : (
          <Text type="secondary">已处理</Text>
        ),
    },
  ];

  return (
    <div>
      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>
            审批中心
          </Title>
          <Text type="secondary">平台管理员审核商家 / 骑手入驻申请</Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={() => void applicationsQuery.refetch()}>
          刷新
        </Button>
      </Space>

      <SearchFilterBar
        filterPlaceholder="状态筛选"
        filterValue={status}
        filterOptions={[
          { value: 'pending', label: '待审批' },
          { value: 'approved', label: '已通过' },
          { value: 'rejected', label: '已驳回' },
        ]}
        onFilterChange={(v) => setStatus(v)}
        style={{ marginBottom: 12 }}
      />

      <TableCard>
        <Table
          rowKey="id"
          loading={loading}
          dataSource={list}
          columns={columns}
          scroll={{ x: 1100 }}
          pagination={DEFAULT_TABLE_PAGINATION}
          locale={DEFAULT_TABLE_LOCALE}
        />
      </TableCard>

      <Modal
        title="驳回申请"
        open={rejectOpen}
        onCancel={() => setRejectOpen(false)}
        onOk={() => void handleReject()}
        confirmLoading={submitting}
        okText="确认驳回"
        okButtonProps={{ danger: true }}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="rejectReason"
            label="驳回原因"
            rules={[{ required: true, message: '请填写驳回原因' }]}
          >
            <Input.TextArea rows={3} placeholder="必填，将通知申请人" maxLength={200} showCount />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ApprovalsPage;
