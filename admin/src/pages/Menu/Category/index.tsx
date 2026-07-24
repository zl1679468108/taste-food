import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Table, Button, Modal, Form, Input, InputNumber, Select, message, Space, Popconfirm } from 'antd';
import { EditOutlined, DeleteOutlined, CoffeeOutlined } from '@ant-design/icons';
import { getCategories, createCategory, updateCategory, deleteCategory, getMenuItems, Category } from '@/services/menu';
import PageHeaderActions from '@/components/PageHeaderActions';
import TableCard from '@/components/TableCard';
import SearchFilterBar from '@/components/SearchFilterBar';
import { useCrudModal } from '@/hooks/useCrudModal';
import { DEFAULT_TABLE_PAGINATION } from '@/utils/table';
import { DEFAULT_SHOP_ID } from '@/utils/constants';

// 与小程序 client/src/utils/iconMap.ts 中的 CATEGORY_ICONS 对齐
const CATEGORY_ICON_OPTIONS: { value: string; label: string }[] = [
  { value: 'star', label: '🌟 推荐' },
  { value: 'meat', label: '🥩 荤菜' },
  { value: 'vegetable', label: '🥬 素菜' },
  { value: 'drink', label: '🍺 饮品' },
  { value: 'rice', label: '🍚 主食' },
];

const CategoryPage: React.FC = () => {
  const [searchText, setSearchText] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const loadCategories = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getCategories(DEFAULT_SHOP_ID);
      setCategories(res || []);
    } catch (error) {
      console.error('加载分类失败:', error);
      message.error('加载分类失败');
    } finally {
      setLoading(false);
    }
  }, []);

  const {
    form,
    visible: modalVisible,
    submitting,
    editing: editingCategory,
    openCreate: handleAdd,
    openEdit: handleEdit,
    close: closeModal,
    submit: submitModal,
  } = useCrudModal<Category>({ onSuccess: loadCategories });

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const handleDelete = async (id: string) => {
    try {
      // 删除前检查该分类下是否还有菜品，避免误删导致菜品成为孤儿
      const items = await getMenuItems({ shop_id: DEFAULT_SHOP_ID, category_id: id });
      if (items && items.length > 0) {
        message.warning(`该分类下还有 ${items.length} 个菜品，请先迁移或删除菜品后再删除分类`);
        return;
      }
      await deleteCategory(id);
      message.success('删除成功');
      loadCategories();
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handleSubmit = () =>
    submitModal({
      create: (values) => createCategory({ ...values, shopId: DEFAULT_SHOP_ID } as any),
      update: (id, values) => updateCategory(id, values as any),
    });

  const columns = [
    { title: '分类名称', dataIndex: 'name', key: 'name' },
    { title: '排序', dataIndex: 'sortOrder', key: 'sortOrder' },
    {
      title: '图标',
      dataIndex: 'iconKey',
      key: 'iconKey',
      render: (iconKey: string) => {
        const opt = CATEGORY_ICON_OPTIONS.find(o => o.value === iconKey);
        return opt ? opt.label : iconKey || '-';
      },
    },
    {
      title: '操作',
      key: 'action',
      render: (_: Category, record: Category) => (
        <Space>
          <Button type="link" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Popconfirm
            title="确认删除该分类？"
            description="若分类下仍有菜品将无法删除"
            okText="确认删除"
            cancelText="取消"
            okButtonProps={{ danger: true }}
            onConfirm={() => handleDelete(record.id)}
          >
            <Button type="link" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const filteredCategories = useMemo(() => {
    if (!searchText.trim()) return categories;
    return categories.filter((c) => c.name?.includes(searchText.trim()));
  }, [categories, searchText]);

  return (
    <div >
      <PageHeaderActions
        icon={<CoffeeOutlined style={{ marginRight: 8 }} />}
        title="分类管理"
        addText="新增分类"
        onAdd={handleAdd}
        onRefresh={loadCategories}
      />

      <SearchFilterBar
        searchPlaceholder="搜索分类名称"
        onSearch={setSearchText}
        onSearchClear={() => setSearchText('')}
      />
      <TableCard>
        <Table columns={columns} dataSource={filteredCategories} rowKey="id" loading={loading} 
        pagination={DEFAULT_TABLE_PAGINATION}
      />
      </TableCard>

      <Modal
        title={editingCategory ? '编辑分类' : '新增分类'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={closeModal}
        confirmLoading={submitting}
        okText="保存"
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="分类名称" rules={[{ required: true, message: '请输入分类名称' }, { max: 20, message: '分类名称不超过 20 字' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="sortOrder" label="排序" initialValue={0} rules={[{ type: 'number', min: 0, message: '排序必须为非负数' }]}>
            <InputNumber min={0} />
          </Form.Item>
          <Form.Item name="iconKey" label="图标">
            <Select allowClear placeholder="请选择图标">
              {CATEGORY_ICON_OPTIONS.map(opt => (
                <Select.Option key={opt.value} value={opt.value}>{opt.label}</Select.Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default CategoryPage;
