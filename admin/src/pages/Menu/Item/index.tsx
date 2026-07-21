import React, { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Input, InputNumber, Select, message, Space, Popconfirm, Tag, Image } from 'antd';
import { EditOutlined, DeleteOutlined, CoffeeOutlined } from '@ant-design/icons';
import { getMenuItems, createMenuItem, updateMenuItem, deleteMenuItem, getCategories, MenuItem, Category } from '@/services/menu';
import PageHeaderActions from '@/components/PageHeaderActions';
import TableCard from '@/components/TableCard';
import PriceDisplay from '@/components/PriceDisplay';
import { DEFAULT_SHOP_ID } from '@/utils/constants';

const { TextArea } = Input;

const MenuItemPage: React.FC = () => {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [form] = Form.useForm();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
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
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingItem(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (record: MenuItem) => {
    setEditingItem(record);
    // 后端按分存储，表单按元展示
    form.setFieldsValue({
      ...record,
      price: record.price != null ? record.price / 100 : undefined,
    });
    setModalVisible(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteMenuItem(id);
      message.success('删除成功');
      loadData();
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      // 表单按元输入，提交时转分（整数）
      const payload: Partial<MenuItem> = {
        ...values,
        price: Math.round(values.price * 100),
        shopId: DEFAULT_SHOP_ID,
      };
      if (editingItem) {
        await updateMenuItem(editingItem.id, payload);
        message.success('更新成功');
      } else {
        await createMenuItem(payload);
        message.success('创建成功');
      }
      setModalVisible(false);
      loadData();
    } catch (error) {
      if ((error as { errorFields?: unknown })?.errorFields) return; // 表单校验失败，不提示
      console.error('提交失败:', error);
      message.error('操作失败');
    } finally {
      setSubmitting(false);
    }
  };

  const columns = [
    {
      title: '图片',
      dataIndex: 'imageUrl',
      key: 'imageUrl',
      render: (url: string) => url ? <Image src={url} width={50} height={50} /> : '-',
    },
    { title: '菜品名称', dataIndex: 'name', key: 'name' },
    {
      title: '价格',
      dataIndex: 'price',
      key: 'price',
      render: (price: number) => <PriceDisplay price={price} />,
    },
    {
      title: '分类',
      dataIndex: 'categoryId',
      key: 'categoryId',
      render: (categoryId: string) => categories.find(c => c.id === categoryId)?.name || '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={status === 'active' ? 'green' : 'default'}>
          {status === 'active' ? '上架' : '下架'}
        </Tag>
      ),
    },
    { title: '月售', dataIndex: 'salesCount', key: 'salesCount' },
    {
      title: '操作',
      key: 'action',
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

  return (
    <div >
      <PageHeaderActions
        icon={<CoffeeOutlined style={{ marginRight: 8 }} />}
        title="菜品管理"
        addText="新增菜品"
        onAdd={handleAdd}
        onRefresh={loadData}
      />

      <TableCard>
        <Table columns={columns} dataSource={items} rowKey="id" loading={loading} />
      </TableCard>

      <Modal
        title={editingItem ? '编辑菜品' : '新增菜品'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
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
          <Form.Item name="imageUrl" label="图片URL" rules={[{ type: 'url', message: '请输入合法的 URL' }]}>
            <Input placeholder="https://..." />
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
