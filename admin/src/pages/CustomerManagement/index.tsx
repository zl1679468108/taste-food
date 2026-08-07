import React, { useState, useMemo, useEffect } from 'react';
import { Table, Tag, Typography, Avatar, Space, Button, Tooltip, Select } from 'antd';
import { antdMessage as message } from '@/utils/antdApp';
import { UserOutlined, EyeOutlined, TeamOutlined, PlusOutlined } from '@ant-design/icons';
import { ShopCustomerSummary, CustomerSortBy } from '@/services/customer';
import {
  useShopCustomers,
  useShopCustomerProfile,
} from '@/hooks/queries/useCustomerQueries';
import SearchFilterBar from '@/components/SearchFilterBar';
import { formatTime, shortOrderId, formatPrice } from '@/utils/format';
import PageHeaderActions from '@/components/PageHeaderActions';
import TableCard from '@/components/TableCard';
import {
  DEFAULT_PAGE_SIZE,
  DEFAULT_TABLE_PAGINATION,
  DEFAULT_TABLE_LOCALE,
} from '@/utils/table';
import { brand } from '@/theme';
import CustomerProfileDrawer from './components/CustomerProfileDrawer';

const { Text } = Typography;

const statusMap: Record<string, { color: string; text: string }> = {
  active: { color: 'green', text: '正常' },
  disabled: { color: 'red', text: '已禁用' },
  banned: { color: 'volcano', text: '已拉黑' },
};

const sortOptions = [
  { label: '最近下单', value: 'last_order' },
  { label: '消费最多', value: 'total_spent' },
  { label: '订单最多', value: 'order_count' },
];

const rangeOptions = [
  { label: '全部时间', value: undefined as unknown as string },
  { label: '最近 7 天', value: '7' },
  { label: '最近 30 天', value: '30' },
  { label: '最近 90 天', value: '90' },
];

function maskPhone(phone?: string): string {
  if (!phone) return '-';
  return phone.replace(/^(\d{3})\d{4}(\d{4})$/, '$1****$2');
}

const CustomerManagementPage: React.FC = () => {
  const [searchText, setSearchText] = useState('');
  const [sortBy, setSortBy] = useState<CustomerSortBy>('last_order');
  const [rangeFilter, setRangeFilter] = useState<number | undefined>();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [drawerId, setDrawerId] = useState<string | null>(null);

  useEffect(() => {
    setPage(1);
  }, [searchText, sortBy, rangeFilter]);

  const params = useMemo(
    () => ({
      page,
      pageSize,
      keyword: searchText || undefined,
      sortBy,
      hasOrderWithinDays: rangeFilter,
    }),
    [page, pageSize, searchText, sortBy, rangeFilter],
  );

  const customersQuery = useShopCustomers(params);
  const loading = customersQuery.isPending;
  const total = customersQuery.data?.total ?? 0;
  const customers = useMemo<ShopCustomerSummary[]>(
    () => customersQuery.data?.items || [],
    [customersQuery.data],
  );

  const profileQuery = useShopCustomerProfile(drawerId || undefined);
  const profile = profileQuery.data;
  const profileLoading = profileQuery.isPending;

  const openDrawer = (record: ShopCustomerSummary) => setDrawerId(record.id);
  const closeDrawer = () => setDrawerId(null);

  const columns = [
    {
      title: '顾客',
      key: 'user',
      width: 220,
      render: (_: unknown, record: ShopCustomerSummary) => (
        <Space size={12}>
          <Avatar
            src={record.avatarUrl}
            icon={<UserOutlined />}
            size={40}
            style={{ backgroundColor: brand.primary, flexShrink: 0 }}
          />
          <div style={{ minWidth: 0 }}>
            <Text strong ellipsis style={{ maxWidth: 140, display: 'inline-block' }}>
              {record.nickName || '未命名用户'}
            </Text>
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                ID {shortOrderId(record.id)}
              </Text>
            </div>
          </div>
        </Space>
      ),
    },
    {
      title: '手机号',
      dataIndex: 'phone',
      key: 'phone',
      width: 130,
      render: (phone?: string) =>
        phone ? (
          <Text style={{ fontFamily: 'monospace', fontSize: 12 }} copyable={{ text: phone }}>
            {maskPhone(phone)}
          </Text>
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
    {
      title: '订单数',
      dataIndex: 'orderCount',
      key: 'orderCount',
      width: 90,
      sorter: false,
      render: (v: number) => <Text strong>{v}</Text>,
    },
    {
      title: '累计消费',
      dataIndex: 'totalSpent',
      key: 'totalSpent',
      width: 120,
      render: (v: number) => <Text style={{ color: brand.textPrice }}>{formatPrice(v)}</Text>,
    },
    {
      title: '客单价',
      dataIndex: 'avgOrderValue',
      key: 'avgOrderValue',
      width: 110,
      render: (v: number) => <Text>{formatPrice(v)}</Text>,
    },
    {
      title: '最近下单',
      dataIndex: 'lastOrderAt',
      key: 'lastOrderAt',
      width: 160,
      render: (time?: string) =>
        time ? (
          formatTime(time, 'YYYY-MM-DD HH:mm')
        ) : (
          <Text type="secondary">—</Text>
        ),
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
      title: '操作',
      key: 'action',
      width: 100,
      fixed: 'right' as const,
      render: (_: unknown, record: ShopCustomerSummary) => (
        <Button
          type="link"
          size="small"
          icon={<EyeOutlined />}
          onClick={() => openDrawer(record)}
        >
          详情
        </Button>
      ),
    },
  ];

  return (
    <div className="tf-page">
      <PageHeaderActions
        icon={<TeamOutlined style={{ marginRight: 'var(--tf-space-2)' }} />}
        title="顾客管理"
        onRefresh={() => customersQuery.refetch()}
      />

      <TableCard>
        <SearchFilterBar
          searchPlaceholder="搜索昵称 / 手机号"
          onSearch={setSearchText}
          onSearchClear={() => setSearchText('')}
          filterPlaceholder="排序"
          filterValue={sortBy}
          filterOptions={sortOptions}
          onFilterChange={(v) => setSortBy((v as CustomerSortBy) || 'last_order')}
          extra={
            <Select
              allowClear
              placeholder="下单时间"
              value={rangeFilter ? String(rangeFilter) : undefined}
              onChange={(v?: string) => setRangeFilter(v ? Number(v) : undefined)}
              options={rangeOptions}
              style={{ width: 130 }}
            />
          }
        />

        <Table
          columns={columns}
          dataSource={customers}
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
          locale={{
            ...DEFAULT_TABLE_LOCALE,
            emptyText: '本店暂没有顾客（还没有顾客在本店下单）',
          }}
          scroll={{ x: 1080 }}
          onRow={(record) => ({
            onClick: () => openDrawer(record),
            style: { cursor: 'pointer' },
          })}
        />
      </TableCard>

      <CustomerProfileDrawer
        profileId={drawerId || undefined}
        open={!!drawerId}
        onClose={closeDrawer}
        profile={profile}
        loading={profileLoading}
      />
    </div>
  );
};

export default CustomerManagementPage;
