import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ModalForm, ProFormText, ProFormDigit, ProFormSelect } from '@ant-design/pro-components';
import { Button, Popconfirm, Space, Table, message } from 'antd';
import { EditOutlined, DeleteOutlined, AppstoreOutlined } from '@ant-design/icons';
import {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  getMenuItems,
  Category,
} from '@/services/menu';
import { useShopContext } from '@/hooks/useShopContext';
import { DEFAULT_TABLE_PAGINATION, DEFAULT_TABLE_LOCALE } from '@/utils/table';
import PageHeaderActions from '@/components/PageHeaderActions';
import TableCard from '@/components/TableCard';
import SearchFilterBar from '@/components/SearchFilterBar';

const CATEGORY_ICON_OPTIONS = [
  { value: 'star', label: '推荐' },
  { value: 'meat', label: '荤菜' },
  { value: 'vegetable', label: '素菜' },
  { value: 'drink', label: '饮品' },
  { value: 'rice', label: '主食' },
];

const CategoryPage: React.FC = () => {
  const { shopId, ready, currentShop } = useShopContext();
  const [searchText, setSearchText] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);

  const loadData = useCallback(async () => {
    if (!shopId) return;
    setLoading(true);
    try {
      const list = (await getCategories(shopId)) || [];
      setCategories(list);
    } catch (error) {
      console.error('加载分类失败:', error);
      setCategories([]);
    } finally {
      setLoading(false);
    }
  }, [shopId]);

  useEffect(() => {
    if (!ready || !shopId) return;
    loadData();
  }, [loadData, ready, shopId]);

  const handleDelete = async (id: string) => {
    try {
      const items = await getMenuItems({ shop_id: shopId, category_id: id });
      if (items && items.length > 0) {
        message.warning(`该分类下还有 ${items.length} 个菜品，请先迁移或删除菜品后再删除分类`);
        return;
      }
      await deleteCategory(id);
      message.success('删除成功');
      loadData();
    } catch (error) {
      console.error('删除分类失败:', error);
    }
  };

  const columns = [
    {
      title: '分类名称',
      dataIndex: 'name',
      key: 'name',
      width: 180,
    },
    {
      title: '排序',
      dataIndex: 'sortOrder',
      key: 'sortOrder',
      width: 100,
      sorter: (a: Category, b: Category) => (a.sortOrder || 0) - (b.sortOrder || 0),
    },
    {
      title: '图标',
      dataIndex: 'iconKey',
      key: 'iconKey',
      width: 140,
      render: (iconKey: string) => {
        const opt = CATEGORY_ICON_OPTIONS.find((o) => o.value === iconKey);
        return opt ? `${opt.label} (${iconKey})` : iconKey || '-';
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      fixed: 'right' as const,
      render: (_: Category, record: Category) => (
        <Space>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => {
              setEditing(record);
              setModalOpen(true);
            }}
          >
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
    const keyword = searchText.trim();
    if (!keyword) return categories;
    return categories.filter((c) => c.name?.includes(keyword));
  }, [categories, searchText]);

  return (
    <div className="tf-page">
      <PageHeaderActions
        icon={<AppstoreOutlined style={{ marginRight: 8 }} />}
        title={currentShop?.name ? `分类管理 · ${currentShop.name}` : '分类管理'}
        onRefresh={loadData}
        addText="新增分类"
        onAdd={() => {
          setEditing(null);
          setModalOpen(true);
        }}
      />

      <TableCard className="tf-table-card">
        <SearchFilterBar
          searchPlaceholder="搜索分类名称"
          onSearch={setSearchText}
          onSearchClear={() => setSearchText('')}
        />
        <Table
          columns={columns}
          dataSource={filteredCategories}
          rowKey="id"
          loading={loading}
          size="small"
          pagination={DEFAULT_TABLE_PAGINATION}
          locale={DEFAULT_TABLE_LOCALE}
          scroll={{ x: 700 }}
        />
      </TableCard>

      <ModalForm
        title={editing ? '编辑分类' : '新增分类'}
        open={modalOpen}
        modalProps={{
          destroyOnClose: true,
          onCancel: () => setModalOpen(false),
        }}
        initialValues={
          editing
            ? {
                name: editing.name,
                sortOrder: editing.sortOrder ?? 0,
                iconKey: editing.iconKey,
              }
            : { sortOrder: 0 }
        }
        onFinish={async (values) => {
          try {
            if (editing) {
              await updateCategory(editing.id, values as any);
              message.success('更新成功');
            } else {
              await createCategory({ ...values, shopId } as any);
              message.success('创建成功');
            }
            setModalOpen(false);
            loadData();
            return true;
          } catch (error) {
            console.error('保存分类失败:', error);
            return false;
          }
        }}
      >
        <ProFormText
          name="name"
          label="分类名称"
          rules={[
            { required: true, message: '请输入分类名称' },
            { max: 20, message: '分类名称不超过 20 字' },
          ]}
        />
        <ProFormDigit
          name="sortOrder"
          label="排序"
          min={0}
          fieldProps={{ precision: 0 }}
          rules={[{ required: true, message: '请输入排序' }]}
        />
        <ProFormSelect
          name="iconKey"
          label="图标"
          allowClear
          options={CATEGORY_ICON_OPTIONS}
          placeholder="请选择图标"
        />
      </ModalForm>
    </div>
  );
};

export default CategoryPage;
