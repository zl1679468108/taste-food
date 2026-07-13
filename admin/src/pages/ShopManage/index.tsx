import React, { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Input, InputNumber, message, Space, Popconfirm, Typography, Card, Tag, Switch } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ShopOutlined, ReloadOutlined } from '@ant-design/icons';
import {
  getShops,
  createShop,
  updateShop,
  updateShopStatus,
  deleteShop,
  Shop as ShopModel,
} from '@/services/shop';
import { formatTime, formatPrice } from '@/utils/format';

const { Title, Text } = Typography;

const ShopManagePage: React.FC = () => {
  const [shops, setShops] = useState<ShopModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingShop, setEditingShop] = useState<ShopModel | null>(null);
  const [form] = Form.useForm();

  useEffect(() => {
    loadShops();
  }, []);

  const loadShops = async () => {
    setLoading(true);
    try {
      const res = await getShops();
      setShops(res || []);
    } catch (error) {
      console.error('加载店铺失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingShop(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (record: ShopModel) => {
    setEditingShop(record);
    form.setFieldsValue({
      ...record,
      deliveryRange: record.deliveryRange ? record.deliveryRange / 1000 : 3,
      deliveryFee: record.deliveryFee ? record.deliveryFee / 100 : 5,
      minOrderAmount: record.minOrderAmount ? record.minOrderAmount / 100 : 0,
    });
    setModalVisible(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteShop(id);
      message.success('删除成功');
      loadShops();
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handleStatusChange = async (record: ShopModel, checked: boolean) => {
    try {
      await updateShopStatus(record.id, checked ? 'open' : 'closed');
      message.success('状态更新成功');
      loadShops();
    } catch (error) {
      message.error('状态更新失败');
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      const data = {
        ...values,
        deliveryRange: values.deliveryRange * 1000,
        deliveryFee: values.deliveryFee * 100,
        minOrderAmount: values.minOrderAmount * 100,
      };

      if (editingShop) {
        await updateShop(editingShop.id, data);
        message.success('更新成功');
      } else {
        await createShop(data);
        message.success('创建成功');
      }
      setModalVisible(false);
      loadShops();
    } catch (error) {
      if ((error as any)?.errorFields) return; // 表单校验失败，不提示
      message.error('操作失败');
    } finally {
      setSubmitting(false);
    }
  };

  const columns = [
    {
      title: '店铺名称',
      dataIndex: 'name',
      key: 'name',
      render: (name: string) => <Text strong>{name}</Text>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string, record: ShopModel) => (
        <Switch
          checked={status === 'open'}
          onChange={(checked) => handleStatusChange(record, checked)}
          checkedChildren="营业中"
          unCheckedChildren="已打烊"
        />
      ),
    },
    {
      title: '配送范围',
      dataIndex: 'deliveryRange',
      key: 'deliveryRange',
      render: (range: number) => `${(range / 1000).toFixed(1)} km`,
    },
    {
      title: '配送费',
      dataIndex: 'deliveryFee',
      key: 'deliveryFee',
      render: (fee: number) => formatPrice(fee),
    },
    {
      title: '起送价',
      dataIndex: 'minOrderAmount',
      key: 'minOrderAmount',
      render: (amount: number) => formatPrice(amount),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (time: string) => formatTime(time, 'YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: ShopModel, record: ShopModel) => (
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0 }}>
          <ShopOutlined style={{ marginRight: 8 }} />
          多店铺管理
        </Title>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadShops}>
            刷新
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            新增店铺
          </Button>
        </Space>
      </div>

      <Card
        bordered={false}
        style={{ borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
      >
        <Table columns={columns} dataSource={shops} rowKey="id" loading={loading} />
      </Card>

      <Modal
        title={editingShop ? '编辑店铺' : '新增店铺'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        confirmLoading={submitting}
        okText="保存"
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="店铺名称" rules={[{ required: true, message: '请输入店铺名称' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="店铺描述">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="address" label="店铺地址">
            <Input />
          </Form.Item>
          <Form.Item name="phone" label="联系电话">
            <Input />
          </Form.Item>
          <Form.Item name="logoUrl" label="Logo URL">
            <Input />
          </Form.Item>
          <Form.Item name="deliveryRange" label="配送范围（公里）" initialValue={3}>
            <InputNumber min={0.5} max={20} step={0.5} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="deliveryFee" label="配送费（元）" initialValue={5}>
            <InputNumber min={0} max={50} step={0.5} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="minOrderAmount" label="起送价（元）" initialValue={0}>
            <InputNumber min={0} max={100} step={5} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ShopManagePage;