import { useCallback, useEffect, useMemo, useState } from 'react';
import { Table, Tag, Typography } from 'antd';
import { AuditOutlined } from '@ant-design/icons';
import { AuditLog, getAuditLogs } from '@/services/audit';
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
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [total, setTotal] = useState(0);
  const [method, setMethod] = useState<string | undefined>();
  const [searchText, setSearchText] = useState('');

  const load = useCallback(async (p = page, ps = pageSize, m = method) => {
    setLoading(true);
    try {
      const res = await getAuditLogs({ page: p, pageSize: ps, method: m });
      setLogs(res?.items || []);
      setTotal(res?.total || 0);
      setPage(res?.page || p);
      setPageSize(res?.pageSize || ps);
    } catch (e) {
      console.error('加载审计日志失败:', e);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, method]);

  useEffect(() => {
    load(1, pageSize, method);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [method]);

  const filteredLogs = useMemo(() => {
    const keyword = searchText.trim().toLowerCase();
    if (!keyword) return logs;
    return logs.filter((row) => {
      const actionLabel = renderAction(row);
      const summaryLabel = renderSummary(row);
      const resourceLabel = getAuditResourceLabel(row.resource);
      const roleLabel = getAuditRoleLabel(row.role);
      const haystack = [
        row.summary,
        row.action,
        row.path,
        row.resource,
        row.userId,
        row.ip,
        actionLabel,
        summaryLabel,
        resourceLabel,
        roleLabel,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(keyword);
    });
  }, [logs, searchText]);

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
          <Text style={{ fontSize: 12 }}>
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
          <div style={{ fontFamily: 'monospace', fontSize: 12 }}>{v ? shortOrderId(v) : '-'}</div>
          {row.role ? (
            <Text type="secondary" style={{ fontSize: 12 }}>
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
        icon={<AuditOutlined style={{ marginRight: 8 }} />}
        title="操作审计"
        onRefresh={() => load(page, pageSize, method)}
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
          columns={columns as any}
          dataSource={filteredLogs}
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
              load(nextPage, nextPageSize, method);
            },
            showTotal: (t) => `共 ${t} 条`,
          }}
        />
      </TableCard>
    </div>
  );
}
