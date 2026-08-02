import { useState, useEffect } from 'react';
import { Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { AuditOutlined } from '@ant-design/icons';
import { AuditLog } from '@/services/audit';
import { useAuditLogs } from '@/hooks/queries';
import { formatTime, shortOrderId } from '@/utils/format';
import {
  getAuditActionLabel,
  getAuditResourceLabel,
  getAuditRoleLabel,
  getAuditSummaryLabel,
} from '@/utils/auditLabels';
import { DEFAULT_PAGE_SIZE, DEFAULT_TABLE_PAGINATION } from '@/utils/table';
import PageHeaderActions from '@/components/PageHeaderActions';
import TableCard from '@/components/TableCard';
import SearchFilterBar from '@/components/SearchFilterBar';
import EmptyState from '@/components/EmptyState';

const { Text } = Typography;

const methodColor: Record<string, string> = {
  POST: 'blue',
  PATCH: 'orange',
  PUT: 'gold',
  DELETE: 'red',
};

function renderSummary(row: AuditLog): string {
  return getAuditSummaryLabel(row.summary, {
    action: row.action,
    method: row.method,
    resource: row.resource,
    path: row.path,
  });
}

function renderAction(row: AuditLog): string {
  return getAuditActionLabel(row.action, row.method, row.resource, row.path);
}

export default function AuditPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [method, setMethod] = useState<string | undefined>();
  const [searchText, setSearchText] = useState('');
  // 搜索变化时重置页码，避免空白页
  useEffect(() => {
    setPage(1);
  }, [searchText]);

  const auditQuery = useAuditLogs({ page, pageSize, method, keyword: searchText || undefined });
  const logs = auditQuery.data?.items ?? [];
  const total = auditQuery.data?.total ?? 0;
  const loading = auditQuery.isPending;

  const columns = [
    {
      title: '时间',
      dataIndex: 'createdAt',
      width: 180,
      render: (v: string) => formatTime(v, 'YYYY-MM-DD HH:mm:ss'),
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
      width: 150,
      ellipsis: true,
      render: (_: string, row: AuditLog) => renderAction(row),
    },
    {
      title: '摘要',
      dataIndex: 'summary',
      width: 320,
      render: (_: string, row: AuditLog) => (
        <Text ellipsis={{ tooltip: renderSummary(row) }} style={{ maxWidth: 300, display: 'inline-block' }}>
          {renderSummary(row)}
        </Text>
      ),
    },
    {
      title: '资源',
      dataIndex: 'resource',
      width: 140,
      render: (v: string, row: AuditLog) =>
        v ? (
          <Text style={{ fontSize: 'var(--tf-font-xs)' }}>
            {getAuditResourceLabel(v)}
            {row.resourceId ? ` / ${shortOrderId(String(row.resourceId))}` : ''}
          </Text>
        ) : (
          '-'
        ),
    },
    {
      title: '操作人',
      dataIndex: 'userId',
      width: 110,
      render: (v: string, row: AuditLog) => (
        <div>
          <div style={{ fontFamily: 'monospace', fontSize: 'var(--tf-font-xs)' }}>{v ? shortOrderId(v) : '-'}</div>
          {row.role ? (
            <Text type="secondary" style={{ fontSize: 'var(--tf-font-xs)' }}>
              {getAuditRoleLabel(row.role)}
            </Text>
          ) : null}
        </div>
      ),
    },
    {
      title: '状态',
      dataIndex: 'statusCode',
      width: 80,
      render: (v?: number) =>
        v == null ? '-' : <Tag color={v >= 400 ? 'red' : 'green'}>{v}</Tag>,
    },
    {
      title: 'IP',
      dataIndex: 'ip',
      width: 130,
      ellipsis: true,
      render: (v: string) => v || '-',
    },
  ];

  return (
    <div className="tf-page">
      <PageHeaderActions
        icon={<AuditOutlined style={{ marginRight: 'var(--tf-space-2)' }} />}
        title="操作审计"
        onRefresh={() => void auditQuery.refetch()}
      />

      <TableCard>
        <SearchFilterBar
          searchPlaceholder="搜索摘要 / 动作 / 资源"
          onSearch={setSearchText}
          onSearchClear={() => setSearchText('')}
          filterPlaceholder="按方法筛选"
          filterValue={method}
          filterOptions={[
            { label: 'POST', value: 'POST' },
            { label: 'PATCH', value: 'PATCH' },
            { label: 'PUT', value: 'PUT' },
            { label: 'DELETE', value: 'DELETE' },
          ]}
          onFilterChange={(v) => {
            setMethod(v);
            setPage(1);
          }}
        />

        <Table
          rowKey="id"
          loading={loading}
          columns={columns as ColumnsType<AuditLog>}
          dataSource={logs}
          size="small"
          scroll={{ x: 1200 }}
          locale={{
            emptyText: (
              <EmptyState description="暂无审计数据，后台写操作（接单/改菜/改桌台等）成功后会记录" />
            ),
          }}
          pagination={{
            ...DEFAULT_TABLE_PAGINATION,
            current: page,
            total,
            pageSize,
            onChange: (nextPage, nextPageSize) => {
              setPage(nextPage);
              setPageSize(nextPageSize);
            },
            showTotal: (t) => `共 ${t} 条`,
          }}
        />
      </TableCard>
    </div>
  );
}
