import { useMemo, useState } from 'react';
import {
  Button,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Space,
  Switch,
  Table,
  Typography,
  message,
  Image,
  Tag,
} from 'antd';
import { QrcodeOutlined, TableOutlined } from '@ant-design/icons';
import PageHeaderActions from '@/components/PageHeaderActions';
import TableCard from '@/components/TableCard';
import SearchFilterBar from '@/components/SearchFilterBar';
import EmptyState from '@/components/EmptyState';
import { ShopTable, buildTableQrImageUrl } from '@/services/table';
import {
  useTables,
  useShop,
  useCreateTable,
  useUpdateTable,
  useDeleteTable,
  useSeedTables,
} from '@/hooks/queries';
import { useShopContext } from '@/hooks/useShopContext';
import { DEFAULT_TABLE_PAGINATION } from '@/utils/table';

const { Text } = Typography;

export default function ShopTablesPage() {
  const { shopId, ready } = useShopContext();
  const [searchText, setSearchText] = useState('');
  const [activeFilter, setActiveFilter] = useState<string | undefined>();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ShopTable | null>(null);
  const [qrTable, setQrTable] = useState<ShopTable | null>(null);
  const [form] = Form.useForm();

  const activeShopId = ready && shopId ? shopId : '';
  const tablesQuery = useTables(activeShopId);
  const tables = tablesQuery.data ?? [];
  const loading = tablesQuery.isPending;

  const shopQuery = useShop(activeShopId);
  const shopName = shopQuery.data?.name || '';

  const createMutation = useCreateTable();
  const updateMutation = useUpdateTable();
  const deleteMutation = useDeleteTable();
  const seedMutation = useSeedTables();
  const seeding = seedMutation.isPending;

  const onSubmit = async () => {
    const values = await form.validateFields();
    try {
      if (editing) {
        await updateMutation.mutateAsync({ shopId, tableId: editing.id, data: values });
        message.success('桌台已更新');
      } else {
        await createMutation.mutateAsync({ shopId, data: values });
        message.success('桌台已创建');
      }
      setOpen(false);
      setEditing(null);
      form.resetFields();
    } catch (e) {
      console.error('保存桌台失败:', e);
    }
  };

  const handleSeed = async () => {
    try {
      await seedMutation.mutateAsync(shopId);
      message.success('已初始化 A01-A10');
    } catch (e) {
      console.error('初始化桌台失败:', e);
    }
  };

  const handleAdd = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ active: true, sortOrder: tables.length + 1 });
    setOpen(true);
  };

  const filteredTables = useMemo(() => {
    const keyword = searchText.trim().toLowerCase();
    return tables.filter((t) => {
      const matchKeyword =
        !keyword ||
        (t.tableNo || '').toLowerCase().includes(keyword) ||
        (t.label || '').toLowerCase().includes(keyword);
      const matchActive =
        !activeFilter ||
        (activeFilter === 'active' && t.active) ||
        (activeFilter === 'inactive' && !t.active);
      return matchKeyword && matchActive;
    });
  }, [tables, searchText, activeFilter]);

  const columns = useMemo(
    () => [
      {
        title: '桌号',
        dataIndex: 'tableNo',
        width: 100,
        render: (v: string) => <Text strong>{v}</Text>,
      },
      {
        title: '名称',
        dataIndex: 'label',
        width: 160,
        ellipsis: true,
        render: (v: string) => v || '-',
      },
      {
        title: '排序',
        dataIndex: 'sortOrder',
        width: 80,
      },
      {
        title: '状态',
        dataIndex: 'active',
        width: 90,
        render: (v: boolean) => (v ? <Tag color="green">启用</Tag> : <Tag>停用</Tag>),
      },
      {
        title: '扫码 Path',
        dataIndex: 'scanPath',
        ellipsis: true,
        render: (v: string) => (
          <Text copyable={{ text: v }} style={{ fontFamily: 'monospace', fontSize: 12 }}>
            {v}
          </Text>
        ),
      },
      {
        title: '操作',
        width: 200,
        fixed: 'right' as const,
        render: (_: unknown, row: ShopTable) => (
          <Space size={0}>
            <Button
              type="link"
              size="small"
              onClick={() => {
                setEditing(row);
                form.setFieldsValue({
                  tableNo: row.tableNo,
                  label: row.label,
                  sortOrder: row.sortOrder,
                  active: row.active,
                });
                setOpen(true);
              }}
            >
              编辑
            </Button>
            <Button type="link" size="small" icon={<QrcodeOutlined />} onClick={() => setQrTable(row)}>
              二维码
            </Button>
            <Popconfirm
              title="确认删除该桌台？"
              onConfirm={async () => {
                try {
                  await deleteMutation.mutateAsync({ shopId, tableId: row.id });
                  message.success('已删除');
                } catch (e) {
                  console.error('删除桌台失败:', e);
                }
              }}
            >
              <Button type="link" size="small" danger>
                删除
              </Button>
            </Popconfirm>
          </Space>
        ),
      },
    ],
    [form, deleteMutation, shopId],
  );

  return (
    <div className="tf-page">
      <PageHeaderActions
        icon={<TableOutlined style={{ marginRight: 8 }} />}
        title="桌台与扫码"
        addText="新增桌台"
        onAdd={handleAdd}
        onRefresh={() => {
          void tablesQuery.refetch();
          void shopQuery.refetch();
        }}
        extra={
          <Button onClick={handleSeed} loading={seeding}>
            初始化 A01-A10
          </Button>
        }
      />

      <TableCard>
        <div style={{ marginBottom: 12 }}>
          <Space wrap size={8}>
            <Tag color="blue">当前店铺</Tag>
            <Text strong>{shopName || '默认店铺'}</Text>
            <Text type="secondary" style={{ fontFamily: 'monospace', fontSize: 12 }}>
              {shopId}
            </Text>
          </Space>
          <div style={{ marginTop: 6 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              桌台按店铺绑定（/api/shops/:shopId/tables）。开发可用普通二维码；正式环境请用微信小程序码。
            </Text>
          </div>
        </div>

        <SearchFilterBar
          searchPlaceholder="搜索桌号 / 名称"
          onSearch={setSearchText}
          onSearchClear={() => setSearchText('')}
          filterPlaceholder="按状态筛选"
          filterValue={activeFilter}
          filterOptions={[
            { label: '启用', value: 'active' },
            { label: '停用', value: 'inactive' },
          ]}
          onFilterChange={setActiveFilter}
        />

        <Table
          rowKey="id"
          loading={loading}
          columns={columns as any}
          dataSource={filteredTables}
          size="small"
          pagination={DEFAULT_TABLE_PAGINATION}
          scroll={{ x: 900 }}
          locale={{
            emptyText: (
              <EmptyState
                description="暂无桌台，可一键初始化 A01-A10"
                actionText="初始化 A01-A10"
                onAction={handleSeed}
              />
            ),
          }}
        />
      </TableCard>

      <Modal
        title={editing ? '编辑桌台' : '新增桌台'}
        open={open}
        onCancel={() => {
          setOpen(false);
          setEditing(null);
        }}
        onOk={onSubmit}
        destroyOnClose
        okText="保存"
      >
        <Form form={form} layout="vertical" initialValues={{ active: true, sortOrder: 0 }}>
          <Form.Item name="tableNo" label="桌号" rules={[{ required: true, message: '请输入桌号' }]}>
            <Input placeholder="如 A01" maxLength={32} />
          </Form.Item>
          <Form.Item name="label" label="显示名称">
            <Input placeholder="如 靠窗双人桌" maxLength={64} />
          </Form.Item>
          <Form.Item name="sortOrder" label="排序">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="active" label="启用" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={qrTable ? `桌号 ${qrTable.tableNo}` : '二维码'}
        open={!!qrTable}
        onCancel={() => setQrTable(null)}
        footer={null}
      >
        {qrTable && (
          <Space direction="vertical" style={{ width: '100%' }} align="center">
            <Image width={220} src={buildTableQrImageUrl(qrTable.scanPath)} alt={qrTable.tableNo} />
            <Text copyable>{qrTable.scanPath}</Text>
            <Text type="secondary" style={{ fontSize: 12, textAlign: 'center' }}>
              打印贴桌；顾客微信扫码打开菜单并自动带桌号
            </Text>
          </Space>
        )}
      </Modal>
    </div>
  );
}
