import { useMemo, useState } from 'react';
import {
  Button,
  Form,
  Image,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Space,
  Switch,
  Table,
  Typography,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { QrcodeOutlined } from '@ant-design/icons';
import { ShopTable, buildTableQrImageUrl } from '@/services/table';
import {
  useTables,
  useCreateTable,
  useUpdateTable,
  useDeleteTable,
  useSeedTables,
} from '@/hooks/queries';
import SearchFilterBar from '@/components/SearchFilterBar';
import EmptyState from '@/components/EmptyState';
import { DEFAULT_TABLE_PAGINATION } from '@/utils/table';

const { Text } = Typography;

interface ShopTablesPanelProps {
  shopId: string;
  compact?: boolean;
}

/**
 * 店铺桌台与扫码管理面板（嵌入店铺编辑抽屉复用）
 */
const ShopTablesPanel: React.FC<ShopTablesPanelProps> = ({ shopId, compact }) => {
  const [searchText, setSearchText] = useState('');
  const [activeFilter, setActiveFilter] = useState<string | undefined>();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ShopTable | null>(null);
  const [qrTable, setQrTable] = useState<ShopTable | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [form] = Form.useForm();

  const tablesQuery = useTables(shopId);
  const tables = tablesQuery.data ?? [];
  const loading = tablesQuery.isPending;

  const createMutation = useCreateTable();
  const updateMutation = useUpdateTable();
  const deleteMutation = useDeleteTable();
  const seedMutation = useSeedTables();
  const seeding = seedMutation.isPending;
  const saving = createMutation.isPending || updateMutation.isPending;

  const filteredTables = useMemo(() => {
    const keyword = searchText.trim().toLowerCase();
    return tables.filter((t) => {
      const matchKeyword =
        !keyword ||
        (t.tableNo || '').toLowerCase().includes(keyword) ||
        (t.label || '').toLowerCase().includes(keyword);
      const matchActive =
        !activeFilter ||
        (activeFilter === 'active' ? t.active : !t.active);
      return matchKeyword && matchActive;
    });
  }, [tables, searchText, activeFilter]);

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

  const columns = useMemo(
    () => [
      {
        title: '桌号',
        dataIndex: 'tableNo',
        key: 'tableNo',
        width: 90,
      },
      {
        title: '名称',
        dataIndex: 'label',
        key: 'label',
        width: 140,
        ellipsis: true,
        render: (v?: string) => v || '-',
      },
      {
        title: '排序',
        dataIndex: 'sortOrder',
        key: 'sortOrder',
        width: 70,
      },
      {
        title: '状态',
        dataIndex: 'active',
        key: 'active',
        width: 80,
        render: (active: boolean) => (active ? '启用' : '停用'),
      },
      {
        title: '扫码 Path',
        dataIndex: 'scanPath',
        key: 'scanPath',
        ellipsis: true,
        render: (v: string) => (
          <Text copyable style={{ fontSize: 12, fontFamily: 'monospace' }}>
            {v}
          </Text>
        ),
      },
      {
        title: '操作',
        key: 'action',
        width: 180,
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
              okButtonProps={{ danger: true, loading: deletingId === row.id }}
              onConfirm={async () => {
                setDeletingId(row.id);
                try {
                  await deleteMutation.mutateAsync({ shopId, tableId: row.id });
                  message.success('已删除');
                } catch (e) {
                  console.error('删除桌台失败:', e);
                } finally {
                  setDeletingId(null);
                }
              }}
            >
              <Button type="link" size="small" danger loading={deletingId === row.id}>
                删除
              </Button>
            </Popconfirm>
          </Space>
        ),
      },
    ],
    [form, deleteMutation, shopId, deletingId],
  );

  return (
    <div>
      <Space wrap style={{ marginBottom: 12 }} size={8}>
        <Button
          type="primary"
          disabled={saving}
          onClick={() => {
            setEditing(null);
            form.resetFields();
            form.setFieldsValue({ active: true, sortOrder: 0 });
            setOpen(true);
          }}
        >
          新增桌台
        </Button>
        <Button onClick={handleSeed} loading={seeding}>
          初始化 A01-A10
        </Button>
        <Button onClick={() => tablesQuery.refetch()}>刷新</Button>
      </Space>

      {!compact ? (
        <div style={{ marginBottom: 8 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            桌台按店铺绑定。开发可用普通二维码；正式环境请用微信小程序码。
          </Text>
        </div>
      ) : null}

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
        columns={columns as ColumnsType<ShopTable>}
        dataSource={filteredTables}
        size="small"
        pagination={DEFAULT_TABLE_PAGINATION}
        scroll={{ x: 800 }}
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

      <Modal
        title={editing ? '编辑桌台' : '新增桌台'}
        open={open}
        onCancel={() => {
          setOpen(false);
          setEditing(null);
        }}
        onOk={onSubmit}
        confirmLoading={saving}
        cancelButtonProps={{ disabled: saving }}
        maskClosable={!saving}
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
};

export default ShopTablesPanel;
