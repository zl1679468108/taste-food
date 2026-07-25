import { useEffect, useState } from 'react';
import { Button, Card, Select, Space, Table, Tag, message } from 'antd';
import { PageContainer } from '@ant-design/pro-components';
import { ReloadOutlined } from '@ant-design/icons';
import { AuditLog, getAuditLogs } from '@/services/audit';
import { formatTime } from '@/utils/format';
import { DEFAULT_TABLE_LOCALE } from '@/utils/table';

const methodColor: Record<string, string> = {
  POST: 'blue',
  PATCH: 'orange',
  PUT: 'gold',
  DELETE: 'red',
};

export default function AuditPage() {
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [method, setMethod] = useState<string | undefined>();
  const pageSize = 20;

  const load = async (p = page) => {
    setLoading(true);
    try {
      const res = await getAuditLogs({ page: p, pageSize, method });
      setLogs(res?.items || []);
      setTotal(res?.total || 0);
      setPage(res?.page || p);
    } catch (e: any) {
      message.error(e?.message || '加载审计日志失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [method]);

  const columns = [
    {
      title: '时间',
      dataIndex: 'createdAt',
      width: 170,
      render: (v: string) => formatTime(v),
    },
    {
      title: '方法',
      dataIndex: 'method',
      width: 90,
      render: (v: string) => <Tag color={methodColor[v] || 'default'}>{v}</Tag>,
    },
    {
      title: '动作',
      dataIndex: 'action',
      width: 160,
      ellipsis: true,
    },
    {
      title: '摘要',
      dataIndex: 'summary',
      ellipsis: true,
    },
    {
      title: '资源',
      dataIndex: 'resource',
      width: 100,
      render: (v: string, row: AuditLog) =>
        v ? `${v}${row.resourceId ? `/${String(row.resourceId).slice(0, 8)}` : ''}` : '-',
    },
    {
      title: '操作人',
      dataIndex: 'userId',
      width: 120,
      render: (v: string) => (v ? `${v.slice(0, 8)}…` : '-'),
    },
    {
      title: 'IP',
      dataIndex: 'ip',
      width: 130,
      render: (v: string) => v || '-',
    },
  ];

  return (
    <PageContainer title="操作审计" subTitle="记录商家后台写操作（接单/改菜单/改桌台等）">
      <Card>
        <Space style={{ marginBottom: 16 }} wrap>
          <Select
            allowClear
            placeholder="请求方法"
            style={{ width: 140 }}
            value={method}
            onChange={(v) => setMethod(v)}
            options={[
              { value: 'POST', label: 'POST' },
              { value: 'PATCH', label: 'PATCH' },
              { value: 'PUT', label: 'PUT' },
              { value: 'DELETE', label: 'DELETE' },
            ]}
          />
          <Button icon={<ReloadOutlined />} onClick={() => load(page)}>
            刷新
          </Button>
        </Space>
        <Table
          rowKey="id"
          loading={loading}
          columns={columns as any}
          dataSource={logs}
          locale={DEFAULT_TABLE_LOCALE}
          pagination={{
            current: page,
            total,
            pageSize,
            onChange: (p) => load(p),
            showTotal: (t) => `共 ${t} 条`,
          }}
        />
      </Card>
    </PageContainer>
  );
}
