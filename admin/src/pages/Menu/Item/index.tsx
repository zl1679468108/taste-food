import React, { useCallback, useState, useMemo } from 'react';
import { Table, Button, Modal, Form, Input, InputNumber, Select, message, Space, Popconfirm, Tag, Image } from 'antd';
import { EditOutlined, DeleteOutlined, CoffeeOutlined, PictureOutlined } from '@ant-design/icons';
import { MenuItem } from '@/services/menu';
import PageHeaderActions from '@/components/PageHeaderActions';
import TableCard from '@/components/TableCard';
import SearchFilterBar from '@/components/SearchFilterBar';
import { useCrudModal } from '@/hooks/useCrudModal';
import { DEFAULT_TABLE_PAGINATION, DEFAULT_TABLE_LOCALE } from '@/utils/table';
import PriceDisplay from '@/components/PriceDisplay';
import MediaPicker from '@/components/MediaPicker';
import { useShopContext } from '@/hooks/useShopContext';
import {
  useCategories,
  useMenuItems,
  useCreateMenuItem,
  useUpdateMenuItem,
  useDeleteMenuItem,
} from '@/hooks/queries';

const { TextArea } = Input;

const MenuItemPage: React.FC = () => {
  const { shopId, ready, currentShop } = useShopContext();
  const [searchText, setSearchText] = useState('');
  const [filterCategoryId, setFilterCategoryId] = useState<string | undefined>();

  const enabled = ready && !!shopId;
  const itemsQuery = useMenuItems({ shopId: enabled ? shopId : '' });
  const categoriesQuery = useCategories(enabled ? shopId : '');

  const items = itemsQuery.data ?? [];
  const categories = categoriesQuery.data ?? [];
  const loading = itemsQuery.isPending || categoriesQuery.isPending;

  const createItem = useCreateMenuItem();
  const updateItem = useUpdateMenuItem();
  const deleteItem = useDeleteMenuItem();

  const refresh = useCallback(() => {
    itemsQuery.refetch();
    categoriesQuery.refetch();
  }, [itemsQuery, categoriesQuery]);

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
    }),
  });

  const handleDelete = async (id: string) => {
    try {
      await deleteItem.mutateAsync(id);
      message.success('删除成功');
    } catch (error) {
      console.error('删除菜品失败:', error);
    }
  };

  const handleSubmit = () =>
    submitModal({
      create: (values) =>
        createItem.mutateAsync({
          ...values,
          price: Math.round(Number(values.price) * 100),
          shopId,
        } as any),
      update: (id, values) =>
        updateItem.mutateAsync({
          id,
          data: {
            ...values,
            price: Math.round(Number(values.price) * 100),
            shopId,
          } as any,
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
          <Popconfirm title="确认删除？" onConfirm={() => handleDelete(record.id)}>
            <Button type="link" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchName = !searchText || item.name?.includes(searchText.trim());
      const matchCat = !filterCategoryId || item.categoryId === filterCategoryId;
      return matchName && matchCat;
    });
  }, [items, searchText, filterCategoryId]);

  return (
    <div className="tf-page">
      <PageHeaderActions
        icon={<CoffeeOutlined style={{ marginRight: 8 }} />}
        title={currentShop?.name ? `菜品管理 · ${currentShop.name}` : '菜品管理'}
        addText="新增菜品"
        onAdd={handleAdd}
        onRefresh={refresh}
      />

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
        destroyOnClose
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
