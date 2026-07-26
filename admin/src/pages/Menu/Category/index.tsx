import React, { useRef, useCallback } from 'react';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { ProTable, ModalForm, ProFormText, ProFormDigit, ProFormSelect } from '@ant-design/pro-components';
import { Button, Popconfirm, Space, message } from 'antd';
import { EditOutlined, DeleteOutlined, AppstoreOutlined } from '@ant-design/icons';
import { getCategories, createCategory, updateCategory, deleteCategory, getMenuItems, Category } from '@/services/menu';
import { DEFAULT_SHOP_ID } from '@/utils/constants';
import { DEFAULT_PAGE_SIZE, DEFAULT_TABLE_LOCALE } from '@/utils/table';
import PageHeaderActions from '@/components/PageHeaderActions';
import TableCard from '@/components/TableCard';

const CATEGORY_ICON_OPTIONS = [
  { value: 'star', label: '推荐' },
  { value: 'meat', label: '荤菜' },
  { value: 'vegetable', label: '素菜' },
  { value: 'drink', label: '饮品' },
  { value: 'rice', label: '主食' },
];

const CategoryPage: React.FC = () => {
  const actionRef = useRef<ActionType | undefined>(undefined);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Category | null>(null);

  const reload = useCallback(() => actionRef.current?.reload(), []);

  const handleDelete = async (id: string) => {
    try {
      const items = await getMenuItems({ shop_id: DEFAULT_SHOP_ID, category_id: id });
      if (items && items.length > 0) {
        message.warning(`该分类下还有 ${items.length} 个菜品，请先迁移或删除菜品后再删除分类`);
        return;
      }
      await deleteCategory(id);
      message.success('删除成功');
      reload();
    } catch (error) {
      console.error('删除分类失败:', error);
    }
  };

  const columns: ProColumns<Category>[] = [
    {
      title: '分类名称',
      dataIndex: 'name',
      width: 180,
      fieldProps: { placeholder: '搜索分类名称' },
    },
    {
      title: '排序',
      dataIndex: 'sortOrder',
      width: 100,
      search: false,
      sorter: (a, b) => (a.sortOrder || 0) - (b.sortOrder || 0),
    },
    {
      title: '图标',
      dataIndex: 'iconKey',
      width: 140,
      search: false,
      render: (_, record) => {
        const opt = CATEGORY_ICON_OPTIONS.find((o) => o.value === record.iconKey);
        return opt ? `${opt.label} (${record.iconKey})` : record.iconKey || '-';
      },
    },
    {
      title: '操作',
      valueType: 'option',
      width: 180,
      fixed: 'right',
      render: (_, record) => (
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

  return (
    <div className="tf-page">
      <PageHeaderActions
        icon={<AppstoreOutlined style={{ marginRight: 8 }} />}
        title="分类管理"
        onRefresh={reload}
        addText="新增分类"
        onAdd={() => {
          setEditing(null);
          setModalOpen(true);
        }}
      />
      <TableCard className="tf-table-card">
        <ProTable<Category>
          locale={DEFAULT_TABLE_LOCALE}
          rowKey="id"
          actionRef={actionRef}
          columns={columns}
          size="small"
          sticky
          cardBordered={false}
          search={{ labelWidth: 'auto' }}
          scroll={{ x: 700 }}
          pagination={{
            defaultPageSize: DEFAULT_PAGE_SIZE,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50'],
            showTotal: (total) => `共 ${total} 条`,
          }}
          options={{ density: false, fullScreen: false, reload: false, setting: false }}
          toolBarRender={false}
          request={async (params) => {
            try {
              const list = (await getCategories(DEFAULT_SHOP_ID)) || [];
              const keyword = (params.name || '').trim();
              const filtered = keyword
                ? list.filter((c) => c.name?.includes(keyword))
                : list;
              return { data: filtered, success: true, total: filtered.length };
            } catch (error) {
              console.error('加载分类失败:', error);
              return { data: [], success: false, total: 0 };
            }
          }}
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
              await createCategory({ ...values, shopId: DEFAULT_SHOP_ID } as any);
              message.success('创建成功');
            }
            setModalOpen(false);
            reload();
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
