import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Table, Button, Modal, Form, Input, InputNumber, Select, message, Space, Popconfirm, Tag, Image } from 'antd';
import { PageContainer } from '@ant-design/pro-components';
import { EditOutlined, DeleteOutlined, CoffeeOutlined } from '@ant-design/icons';
import { getMenuItems, createMenuItem, updateMenuItem, deleteMenuItem, getCategories, MenuItem, Category } from '@/services/menu';
import PageHeaderActions from '@/components/PageHeaderActions';
import TableCard from '@/components/TableCard';
import SearchFilterBar from '@/components/SearchFilterBar';
import { useCrudModal } from '@/hooks/useCrudModal';
import { DEFAULT_TABLE_PAGINATION, DEFAULT_TABLE_LOCALE } from '@/utils/table';
import PriceDisplay from '@/components/PriceDisplay';
import ImageUpload from '@/components/ImageUpload';
import { DEFAULT_SHOP_ID } from '@/utils/constants';

const { TextArea } = Input;

const MenuItemPage: React.FC = () => {
  const [searchText, setSearchText] = useState('');
  const [filterCategoryId, setFilterCategoryId] = useState<string | undefined>();
  const [items, setItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [itemsRes, categoriesRes] = await Promise.all([
        getMenuItems({ shop_id: DEFAULT_SHOP_ID }),
        getCategories(DEFAULT_SHOP_ID),
      ]);
      setItems(itemsRes || []);
      setCategories(categoriesRes || []);
    } catch (error) {
      console.error('加载数据失败:', error);
      message.error('加载菜品失败');
    } finally {
      setLoading(false);
    }
  }, []);

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
    onSuccess: loadData,
    mapRecordToForm: (record) => ({
      ...record,
      // 后端按分存储，表单按元展示
      price: record.price != null ? record.price / 100 : undefined,
    }),
  });

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleDelete = async (id: string) => {
    try {
      await deleteMenuItem(id);
      message.success('删除成功');
      loadData();
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handleSubmit = () =>
    submitModal({
      create: (values) =>
        createMenuItem({
          ...values,
          price: Math.round(Number(values.price) * 100),
          shopId: DEFAULT_SHOP_ID,
        } as any),
      update: (id, values) =>
        updateMenuItem(id, {
          ...values,
          price: Math.round(Number(values.price) * 100),
          shopId: DEFAULT_SHOP_ID,
        } as any),
    });

  const columns = [
    {
      title: '图片',
      dataIndex: 'imageUrl',
      key: 'imageUrl',
      width: 80,
      render: (url: string) => url ? <Image src={url} width={50} height={50} /> : '-',
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
      render: (categoryId: string) => categories.find(c => c.id === categoryId)?.name || '-',
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
    <PageContainer title="菜品列表" subTitle="菜品上下架与价格管理">
    <div >
      <PageHeaderActions
        icon={<CoffeeOutlined style={{ marginRight: 8 }} />}
        title="菜品管理"
        addText="新增菜品"
        onAdd={handleAdd}
        onRefresh={loadData}
      />

            <SearchFilterBar
        searchPlaceholder="搜索菜品名称"
        onSearch={setSearchText}
        onSearchClear={() => setSearchText('')}
        filterPlaceholder="按分类筛选"
        filterValue={filterCategoryId}
        filterOptions={categories.map((c) => ({ label: c.name, value: c.id }))}
        onFilterChange={setFilterCategoryId}
      />
      <TableCard>
        <Table columns={columns} dataSource={filteredItems} rowKey="id" loading={loading}
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
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="菜品名称" rules={[{ required: true, message: '请输入菜品名称' }, { max: 30, message: '菜品名称不超过 30 字' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="categoryId" label="所属分类" rules={[{ required: true, message: '请选择所属分类' }]}>
            <Select>
              {categories.map(cat => (
                <Select.Option key={cat.id} value={cat.id}>{cat.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="price" label="价格（元）" rules={[{ required: true, message: '请输入价格' }, { type: 'number', min: 0, message: '价格必须为非负数' }]}>
            <InputNumber min={0} precision={2} style={{ width: '100%' }} placeholder="例如 12.50" />
          </Form.Item>
          <Form.Item name="description" label="描述" rules={[{ max: 200, message: '描述不超过 200 字' }]}>
            <TextArea rows={3} />
          </Form.Item>
          <Form.Item
            name="imageUrl"
            label="菜品图片"
            rules={[
              {
                validator: async (_, value) => {
                  if (!value) return;
                  try {
                    // eslint-disable-next-line no-new
                    new URL(value);
                  } catch {
                    throw new Error('请输入合法的 URL');
                  }
                },
              },
            ]}
          >
            <ImageUpload />
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
    </PageContainer>
  );
};

export default MenuItemPage;
