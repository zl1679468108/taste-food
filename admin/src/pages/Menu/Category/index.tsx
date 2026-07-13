import React, { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Input, InputNumber, message, Space, Popconfirm } from 'antd';
import { EditOutlined, DeleteOutlined, CoffeeOutlined } from '@ant-design/icons';
import { getCategories, createCategory, updateCategory, deleteCategory, Category } from '@/services/menu';
import PageHeaderActions from '@/components/PageHeaderActions';
import TableCard from '@/components/TableCard';
import { DEFAULT_SHOP_ID } from '@/utils/constants';

const CategoryPage: React.FC = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [form] = Form.useForm();

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    setLoading(true);
    try {
      const res = await getCategories(DEFAULT_SHOP_ID);
      setCategories(res || []);
    } catch (error) {
      console.error('加载分类失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingCategory(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (record: Category) => {
    setEditingCategory(record);
    form.setFieldsValue(record);
    setModalVisible(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteCategory(id);
      message.success('删除成功');
      loadCategories();
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      if (editingCategory) {
        await updateCategory(editingCategory.id, values);
        message.success('更新成功');
      } else {
        await createCategory({ ...values, shopId: DEFAULT_SHOP_ID });
        message.success('创建成功');
      }
      setModalVisible(false);
      loadCategories();
    } catch (error) {
      if ((error as any)?.errorFields) return; // 表单校验失败，不提示
      console.error('提交失败:', error);
      message.error('操作失败');
    } finally {
      setSubmitting(false);
    }
  };

  const columns = [
    { title: '分类名称', dataIndex: 'name', key: 'name' },
    { title: '排序', dataIndex: 'sortOrder', key: 'sortOrder' },
    { title: '图标', dataIndex: 'iconKey', key: 'iconKey' },
    {
      title: '操作',
      key: 'action',
      render: (_: Category, record: Category) => (
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

  return (
    <div >
      <PageHeaderActions
        icon={<CoffeeOutlined style={{ marginRight: 8 }} />}
        title="分类管理"
        addText="新增分类"
        onAdd={handleAdd}
        onRefresh={loadCategories}
      />

      <TableCard>
        <Table columns={columns} dataSource={categories} rowKey="id" loading={loading} />
      </TableCard>

      <Modal
        title={editingCategory ? '编辑分类' : '新增分类'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        confirmLoading={submitting}
        okText="保存"
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="分类名称" rules={[{ required: true, message: '请输入分类名称' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="sortOrder" label="排序" initialValue={0}>
            <InputNumber min={0} />
          </Form.Item>
          <Form.Item name="iconKey" label="图标">
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default CategoryPage;
