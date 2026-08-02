import React, { useEffect, useState } from 'react';
import { Table, Button, Tag, Modal, Form, Select, InputNumber, Space, Tooltip } from 'antd';
import { FileExcelOutlined, ReloadOutlined, DownloadOutlined } from '@ant-design/icons';
import { antdMessage as message } from '@/utils/antdApp';
import { downloadBlob } from '@/utils/export';
import {
  connectSocket,
  disconnectSocket,
  onNotificationNew,
  offNotificationNew,
  NotificationNewEvent,
} from '@/services/socket';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/hooks/queries/queryKeys';
import { useExportJobs, useCreateExportJob } from '@/hooks/queries';
import { useShopContext } from '@/hooks/useShopContext';
import { ExportJob, downloadExportJob } from '@/services/export';
import { ORDER_STATUS_MAP, EXPORT_JOB_STATUS_LABEL } from '@taste-food/shared/constants';
import PageHeaderActions from '@/components/PageHeaderActions';
import TableCard from '@/components/TableCard';

const STATUS_COLOR: Record<string, string> = {
  pending: 'default',
  processing: 'processing',
  completed: 'success',
  failed: 'error',
};

const ENTITY_LABEL: Record<string, string> = {
  orders: '订单',
};

function fmt(ts?: string | null): string {
  if (!ts) return '-';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return ts;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

const FILTER_OPTIONS = [
  { value: '', label: '全部状态' },
  ...Object.entries(EXPORT_JOB_STATUS_LABEL).map(([value, label]) => ({ value, label })),
];

const ORDER_STATUS_OPTIONS = Object.entries(ORDER_STATUS_MAP).map(([value, label]) => ({
  value,
  label,
}));

const ExportPage: React.FC = () => {
  const { shopId, ready } = useShopContext();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();

  const effectiveShopId = ready ? shopId : '';
  const jobsQuery = useExportJobs({
    shopId: effectiveShopId,
    status: statusFilter,
    page,
    pageSize,
  });
  const createJob = useCreateExportJob();

  const items = jobsQuery.data?.items ?? [];
  const total = jobsQuery.data?.total ?? 0;
  const hasPending = items.some(
    (j) => j.status === 'pending' || j.status === 'processing',
  );

  // WS 通知：导出完成时刷新列表并提示
  useEffect(() => {
    connectSocket();
    const handler = (n: NotificationNewEvent) => {
      if (n.type === 'export_job') {
        message.success('导出任务已完成，可前往下载');
        qc.invalidateQueries({ queryKey: queryKeys.exportJobs.all() });
      }
    };
    onNotificationNew(handler);
    return () => {
      offNotificationNew(handler);
      disconnectSocket();
    };
  }, [qc]);

  // 轮询兜底：存在进行中任务时每 3 秒拉一次
  useEffect(() => {
    if (!hasPending) return;
    const timer = setInterval(() => jobsQuery.refetch(), 3000);
    return () => clearInterval(timer);
  }, [hasPending, jobsQuery.refetch]);

  const handleDownload = async (job: ExportJob) => {
    try {
      const blob = await downloadExportJob(job.id, shopId);
      downloadBlob(blob, job.fileName || `export_${job.id.slice(0, 8)}.xlsx`);
      message.success('已开始下载');
    } catch (e) {
      console.error('导出下载失败:', e);
      message.error('下载失败，请稍后重试');
    }
  };

  const handleRetry = async (job: ExportJob) => {
    try {
      await createJob.mutateAsync({
        entity: job.entity,
        status: job.params.status,
        maxRows: job.params.maxRows,
        shop_id: shopId,
      });
      message.success('已重新提交导出任务');
    } catch {
      /* 全局拦截器已 toast */
    }
  };

  const handleCreate = async () => {
    const values = await form.validateFields();
    try {
      await createJob.mutateAsync({
        entity: 'orders',
        status: values.status,
        maxRows: values.maxRows,
        shop_id: shopId,
      });
      message.success('已提交导出任务，完成后可在本页下载');
      setModalOpen(false);
      form.resetFields();
      setPage(1);
    } catch {
      /* 全局拦截器已 toast */
    }
  };

  const columns = [
    {
      title: '任务',
      dataIndex: 'id',
      key: 'id',
      width: 120,
      render: (id: string) => <span style={{ fontFamily: 'monospace' }}>{id.slice(0, 8)}</span>,
    },
    {
      title: '实体',
      dataIndex: 'entity',
      key: 'entity',
      width: 90,
      render: (entity: string) => ENTITY_LABEL[entity] || entity,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: (status: string) => (
        <Tag color={STATUS_COLOR[status] || 'default'}>
          {EXPORT_JOB_STATUS_LABEL[status] || status}
        </Tag>
      ),
    },
    {
      title: '行数',
      key: 'rowCount',
      width: 80,
      render: (_: unknown, job: ExportJob) => (job.rowCount != null ? job.rowCount : '-'),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 150,
      render: (ts: string) => fmt(ts),
    },
    {
      title: '完成时间',
      dataIndex: 'completedAt',
      key: 'completedAt',
      width: 150,
      render: (ts: string) => fmt(ts),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: unknown, job: ExportJob) => {
        if (job.status === 'completed') {
          return (
            <Button
              type="link"
              icon={<DownloadOutlined />}
              onClick={() => handleDownload(job)}
            >
              下载
            </Button>
          );
        }
        if (job.status === 'failed') {
          return (
            <Tooltip title={job.errorMessage || '导出失败'}>
              <Button type="link" danger icon={<ReloadOutlined />} onClick={() => handleRetry(job)}>
                重试
              </Button>
            </Tooltip>
          );
        }
        return <span style={{ color: 'var(--tf-text-tertiary)' }}>处理中…</span>;
      },
    },
  ];

  return (
    <div className="tf-page">
      <PageHeaderActions
        icon={<FileExcelOutlined style={{ marginRight: 'var(--tf-space-2)' }} />}
        title="导出中心"
        onRefresh={() => jobsQuery.refetch()}
        onAdd={() => setModalOpen(true)}
        addText="新建导出"
      />

      <TableCard>
        <Space style={{ marginBottom: 'var(--tf-space-3)' }}>
          <Select
            value={statusFilter || ''}
            style={{ width: 160 }}
            options={FILTER_OPTIONS}
            onChange={(v) => {
              setStatusFilter(v || undefined);
              setPage(1);
            }}
            placeholder="状态筛选"
          />
        </Space>

        <Table
          rowKey="id"
          columns={columns}
          dataSource={items}
          loading={jobsQuery.isPending}
          size="small"
          pagination={{
            current: page,
            total,
            pageSize,
            onChange: (nextPage, nextPageSize) => {
              setPage(nextPage);
              setPageSize(nextPageSize);
            },
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50'],
            showTotal: (t) => `共 ${t} 条`,
          }}
        />
      </TableCard>

      <Modal
        title="新建导出任务"
        open={modalOpen}
        onOk={handleCreate}
        onCancel={() => setModalOpen(false)}
        confirmLoading={createJob.isPending}
        okText="提交"
        cancelText="取消"
      >
        <Form form={form} layout="vertical" initialValues={{ entity: 'orders', maxRows: 1000 }}>
          <Form.Item label="导出实体" name="entity">
            <Select disabled options={[{ value: 'orders', label: '订单' }]} />
          </Form.Item>
          <Form.Item label="订单状态（留空=全部）" name="status">
            <Select
              allowClear
              placeholder="全部订单状态"
              options={ORDER_STATUS_OPTIONS}
            />
          </Form.Item>
          <Form.Item
            label="最大行数"
            name="maxRows"
            rules={[{ required: true, message: '请输入最大行数' }]}
          >
            <InputNumber min={1} max={5000} style={{ width: '100%' }} />
          </Form.Item>
          <p style={{ color: 'var(--tf-text-tertiary)', marginBottom: 0 }}>
            仅导出 Excel（.xlsx），不走 CSV。任务在后台生成，完成后会推送通知并可在此下载。
          </p>
        </Form>
      </Modal>
    </div>
  );
};

export default ExportPage;
