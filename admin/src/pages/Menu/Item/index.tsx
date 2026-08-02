import React, { useCallback, useState, useMemo } from 'react';
import { Table, Button, Modal, Form, Input, InputNumber, Select, Space, Popconfirm, Tag, Image } from 'antd';
import { antdMessage as message } from '@/utils/antdApp';
import { EditOutlined, DeleteOutlined, CoffeeOutlined, PictureOutlined } from '@ant-design/icons';
import { MenuItem } from '@/services/menu';
import PageHeaderActions from '@/components/PageHeaderActions';
import AllShopsScopeAlert from '@/components/AllShopsScopeAlert';
import TableCard from '@/components/TableCard';
import SearchFilterBar from '@/components/SearchFilterBar';
import { useCrudModal } from '@/hooks/useCrudModal';
import { DEFAULT_TABLE_PAGINATION, DEFAULT_TABLE_LOCALE } from '@/utils/table';
import PriceDisplay from '@/components/PriceDisplay';
import MediaPicker from '@/components/MediaPicker';
import { useShopContext } from '@/hooks/useShopContext';
import { isRequestErrorHandled } from '@/utils/request';
import {
  useCategories,
  useMenuItems,
  useSpecGroups,
  useCreateMenuItem,
  useUpdateMenuItem,
  useDeleteMenuItem,
  useBatchUpdateMenuItemStatus,
} from '@/hooks/queries';

const { TextArea } = Input;

const MenuItemPage: React.FC = () => {
  const { shopId, ready, currentShop } = useShopContext();
  const [searchText, setSearchText] = useState('');
  const [filterCategoryId, setFilterCategoryId] = useState<string | undefined>();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const enabled = ready && !!shopId;
  const itemsQuery = useMenuItems({
    shopId: enabled ? shopId : '',
    search: searchText || undefined,
  });
  const categoriesQuery = useCategories(enabled ? shopId : '');
  const specGroupsQuery = useSpecGroups(enabled ? shopId : '');

  const items = itemsQuery.data ?? [];
  const categories = categoriesQuery.data ?? [];
  const specGroups = specGroupsQuery.data ?? [];
  const loading = itemsQuery.isPending || categoriesQuery.isPending;

  const createItem = useCreateMenuItem();
  const updateItem = useUpdateMenuItem();
  const deleteItem = useDeleteMenuItem();
  const batchUpdateStatus = useBatchUpdateMenuItemStatus();

  const refresh = useCallback(() => {
    itemsQuery.refetch();
    categoriesQuery.refetch();
  }, [itemsQuery, categoriesQuery]);

  // 防重：mutation pending 期间按钮 loading，请求层再做同 body 互斥兜底
  const batchUpdating = batchUpdateStatus.isPending;

  const handleBatchUpdate = useCallback(
    async (isAvailable: boolean) => {
      if (batchUpdating || selectedRowKeys.length === 0) return;
      try {
        const result = await batchUpdateStatus.mutateAsync({
          ids: selectedRowKeys.map((key) => String(key)),
          isAvailable,
          shopId,
        });
        message.success(
          isAvailable ? `已上架 ${result.updated} 个菜品` : `已下架 ${result.updated} 个菜品`,
        );
        setSelectedRowKeys([]);
        refresh();
      } catch (error) {
        console.error('批量更新菜品状态失败:', error);
        if (!isRequestErrorHandled(error)) {
          message.error('批量更新失败，请重试');
        }
      }
    },
    [batchUpdating, selectedRowKeys, batchUpdateStatus, shopId, refresh],
  );

  const handleBatchActive = () => handleBatchUpdate(true);

  const handleBatchInactive = () => handleBatchUpdate(false);

  const {
    form,
    visible: modalVisible,
    submitting,
    editing: editingItem,
    openCreate: handleAdd,
    openEdit: handleEdit,
    close: closeModal,
    submit: submitModal,
  } = useCrudModal<MenuItem>({
    mapRecordToForm: (record) => ({
      ...record,
      // 后端按分存储，表单按元展示
      price: record.price != null ? record.price / 100 : undefined,
      specGroupIds: record.specGroupIds || record.specs?.map((s) => s.id) || [],
    }),
  });

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await deleteItem.mutateAsync(id);
      message.success('删除成功');
    } catch (error) {
      console.error('删除菜品失败:', error);
    } finally {
      setDeletingId(null);
    }
  };

  const handleSubmit = () =>
    submitModal({
      create: (values) =>
        createItem.mutateAsync({
          ...values,
          price: Math.round(Number(values.price) * 100),
          shopId,
        } as Record<string, unknown>),
      update: (id, values) =>
        updateItem.mutateAsync({
          id,
          data: {
            ...values,
            price: Math.round(Number(values.price) * 100),
            shopId,
          } as Record<string, unknown>,
        }),
    });

  const columns = [
    {
      title: '图片',
      dataIndex: 'imageUrl',
      key: 'imageUrl',
      width: 72,
      render: (url: string) =>
        url ? (
          <Image
            src={url}
            width={48}
            height={48}
            className="tf-menu-item-thumb"
            style={{ objectFit: 'cover', borderRadius: 6 }}
            preview={{ mask: <PictureOutlined /> }}
          />
        ) : (
          <div className="tf-menu-item-thumb-empty">无图</div>
        ),
    },
    { title: '菜品名称', dataIndex: 'name', key: 'name', width: 160 },
    {
      title: '价格',
      dataIndex: 'price',
      key: 'price',
      width: 100,
      render: (price: number) => <PriceDisplay price={price} />,
    },
    {
      title: '分类',
      dataIndex: 'categoryId',
      key: 'categoryId',
      width: 120,
      ellipsis: true,
      render: (categoryId: string) => categories.find((c) => c.id === categoryId)?.name || '-',
    },
    {
      title: '规格',
      key: 'specs',
      width: 120,
      ellipsis: true,
      render: (_: unknown, record: MenuItem) => {
        const names = (record.specs || []).map((s) => s.name);
        if (!names.length) return <span style={{ color: 'var(--tf-text-tertiary, #999)' }}>无</span>;
        return names.join('、');
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: (status: string) => (
        <Tag color={status === 'active' ? 'green' : 'default'}>
          {status === 'active' ? '上架' : '下架'}
        </Tag>
      ),
    },
    { title: '月售', dataIndex: 'salesCount', key: 'salesCount', width: 80 },
    {
      title: '操作',
      key: 'action',
      width: 160,
      fixed: 'right' as const,
      render: (_: MenuItem, record: MenuItem) => (
        <Space>
          <Button type="link" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Popconfirm
            title="确认删除？"
            okButtonProps={{ danger: true, loading: deletingId === record.id }}
            onConfirm={() => handleDelete(record.id)}
          >
            <Button
              type="link"
              danger
              icon={<DeleteOutlined />}
              loading={deletingId === record.id}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const filteredItems = useMemo(
    () => items.filter((item) => !filterCategoryId || item.categoryId === filterCategoryId),
    [items, filterCategoryId],
  );

  const hasSelection = selectedRowKeys.length > 0;

  return (
    <div className="tf-page">
      <PageHeaderActions
        icon={<CoffeeOutlined style={{ marginRight: 'var(--tf-space-2)'}} />}
        title={currentShop?.name ? `菜品管理 · ${currentShop.name}` : '菜品管理'}
        addText="新增菜品"
        onAdd={handleAdd}
        onRefresh={refresh}
        extra={
          <Space size="small">
            <Button
              disabled={!hasSelection}
              loading={batchUpdating}
              onClick={handleBatchActive}
            >
              批量上架{hasSelection ? ` (${selectedRowKeys.length})` : ''}
            </Button>
            <Popconfirm
              title={`确认批量下架选中的 ${selectedRowKeys.length} 个菜品？`}
              onConfirm={handleBatchInactive}
              okText="确认"
              cancelText="取消"
              okButtonProps={{ danger: true }}
              disabled={!hasSelection}
            >
              <Button danger disabled={!hasSelection} loading={batchUpdating}>
                批量下架{hasSelection ? ` (${selectedRowKeys.length})` : ''}
              </Button>
            </Popconfirm>
          </Space>
        }
      />

      <AllShopsScopeAlert />

      <TableCard className="tf-table-card">
        <SearchFilterBar
          searchPlaceholder="搜索菜品名称"
          onSearch={setSearchText}
          onSearchClear={() => setSearchText('')}
          filterPlaceholder="按分类筛选"
          filterValue={filterCategoryId}
          filterOptions={categories.map((c) => ({ label: c.name, value: c.id }))}
          onFilterChange={setFilterCategoryId}
        />
        <Table
          columns={columns}
          dataSource={filteredItems}
          rowKey="id"
          rowSelection={{
            selectedRowKeys,
            onChange: setSelectedRowKeys,
            preserveSelectedRowKeys: true,
          }}
          loading={loading}
          size="small"
          pagination={DEFAULT_TABLE_PAGINATION}
          locale={DEFAULT_TABLE_LOCALE}
          scroll={{ x: 800 }}
        />
      </TableCard>

      <Modal
        title={editingItem ? '编辑菜品' : '新增菜品'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={closeModal}
        confirmLoading={submitting}
        okText="保存"
        width={640}
        destroyOnHidden
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="菜品名称"
            rules={[
              { required: true, message: '请输入菜品名称' },
              { max: 30, message: '菜品名称不超过 30 字' },
            ]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="categoryId" label="所属分类" rules={[{ required: true, message: '请选择所属分类' }]}>
            <Select>
              {categories.map((cat) => (
                <Select.Option key={cat.id} value={cat.id}>
                  {cat.name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="price"
            label="价格（元）"
            rules={[
              { required: true, message: '请输入价格' },
              { type: 'number', min: 0, message: '价格必须为非负数' },
            ]}
          >
            <InputNumber min={0} precision={2} style={{ width: '100%' }} placeholder="例如 12.50" />
          </Form.Item>
          <Form.Item name="description" label="描述" rules={[{ max: 200, message: '描述不超过 200 字' }]}>
            <TextArea rows={3} />
          </Form.Item>
          <Form.Item
            name="imageUrl"
            label="菜品图片"
            extra="主路径：图库批量导入后选择；单张上传仅作补充"
            rules={[
              {
                validator: async (_, value) => {
                  if (!value) return;
                  try {
                    // eslint-disable-next-line no-new
                    new URL(value);
                  } catch {
                    throw new Error('请选择或上传合法的图片');
                  }
                },
              },
            ]}
          >
            <MediaPicker shopId={shopId} />
          </Form.Item>
          <Form.Item
            name="specGroupIds"
            label="规格绑定"
            extra="规格组可多选；顾客加购时将直接使用这些规格，无需再请求单独接口"
          >
            <Select
              mode="multiple"
              allowClear
              placeholder={specGroups.length ? '选择规格组（可选）' : '暂无规格组'}
              optionFilterProp="label"
              options={specGroups.map((sg) => ({
                value: sg.id,
                label: `${sg.name}${sg.isRequired ? '（必选）' : ''}`,
              }))}
            />
          </Form.Item>
          <Form.Item name="status" label="状态" initialValue="active">
            <Select>
              <Select.Option value="active">上架</Select.Option>
              <Select.Option value="inactive">下架</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default MenuItemPage;
