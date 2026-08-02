import React, { useMemo, useState } from 'react';
import { ModalForm, ProFormText, ProFormDigit, ProFormSelect } from '@ant-design/pro-components';
import { Button, Popconfirm, Space, Table } from 'antd';
import { antdMessage as message } from '@/utils/antdApp';
import { EditOutlined, DeleteOutlined, AppstoreOutlined } from '@ant-design/icons';
import { getMenuItems, Category } from '@/services/menu';
import { useShopContext } from '@/hooks/useShopContext';
import {
  useCategories,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
} from '@/hooks/queries';
import { DEFAULT_TABLE_PAGINATION, DEFAULT_TABLE_LOCALE, filterByKeyword } from '@/utils/table';
import PageHeaderActions from '@/components/PageHeaderActions';
import AllShopsScopeAlert from '@/components/AllShopsScopeAlert';
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
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const categoriesQuery = useCategories(ready && shopId ? shopId : '');
  const categories = categoriesQuery.data ?? [];
  const loading = categoriesQuery.isPending;

  const createCategoryMutation = useCreateCategory();
  const updateCategoryMutation = useUpdateCategory();
  const deleteCategoryMutation = useDeleteCategory();

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      const items = await getMenuItems({ shop_id: shopId, category_id: id });
      if (items && items.length > 0) {
        message.warning(`该分类下还有 ${items.length} 个菜品，请先迁移或删除菜品后再删除分类`);
        return;
      }
      await deleteCategoryMutation.mutateAsync({ id, shopId });
      message.success('删除成功');
    } catch (error) {
      console.error('删除分类失败:', error);
    } finally {
      setDeletingId(null);
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

const filteredCategories = useMemo(
  () => filterByKeyword(categories, searchText, ['name']),
  [categories, searchText],
);

  return (
    <div className="tf-page">
      <PageHeaderActions
        icon={<AppstoreOutlined style={{ marginRight: 'var(--tf-space-2)'}} />}
        title={currentShop?.name ? `分类管理 · ${currentShop.name}` : '分类管理'}
        onRefresh={() => categoriesQuery.refetch()}
        addText="新增分类"
        onAdd={() => {
          setEditing(null);
          setModalOpen(true);
        }}
      />

      <AllShopsScopeAlert />

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
          destroyOnHidden: true,
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
              await updateCategoryMutation.mutateAsync({
                id: editing.id,
                data: { ...values, shopId } as Record<string, unknown>,
              });
              message.success('更新成功');
            } else {
              await createCategoryMutation.mutateAsync({ ...values, shopId } as Record<string, unknown>);
              message.success('创建成功');
            }
            setModalOpen(false);
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
