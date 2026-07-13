import React, { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Input, Select, message, Space, Popconfirm, Typography, Tag, DatePicker, Card } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, GiftOutlined, ReloadOutlined } from '@ant-design/icons';
import { getPromotions, createPromotion, updatePromotion, deletePromotion, Promotion } from '@/services/promotion';
import { formatTime } from '@/utils/format';
import { DEFAULT_SHOP_ID } from '@/utils/constants';

const { Title } = Typography;
const { RangePicker } = DatePicker;

const PromotionPage: React.FC = () => {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingPromotion, setEditingPromotion] = useState<Promotion | null>(null);
  const [form] = Form.useForm();

  useEffect(() => {
    loadPromotions();
  }, []);

  const loadPromotions = async () => {
    setLoading(true);
    try {
      const res = await getPromotions(DEFAULT_SHOP_ID);
      setPromotions(res || []);
    } catch (error) {
      console.error('加载促销失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingPromotion(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (record: Promotion) => {
    setEditingPromotion(record);
    form.setFieldsValue({
      ...record,
      dateRange: record.startDate && record.endDate ?
        [new Date(record.startDate), new Date(record.endDate)] : null,
    });
    setModalVisible(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await deletePromotion(id);
      message.success('删除成功');
      loadPromotions();
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const { dateRange, ...rest } = values;
      setSubmitting(true);

      const data: Partial<Promotion> = {
        ...rest,
        shopId: DEFAULT_SHOP_ID,
      };

      if (dateRange && dateRange[0] && dateRange[1]) {
        data.startDate = dateRange[0].toISOString();
        data.endDate = dateRange[1].toISOString();
      }

      if (editingPromotion) {
        await updatePromotion(editingPromotion.id, data);
        message.success('更新成功');
      } else {
        await createPromotion(data);
        message.success('创建成功');
      }
      setModalVisible(false);
      loadPromotions();
    } catch (error) {
      if ((error as any)?.errorFields) return; // 表单校验失败，不提示
      console.error('提交失败:', error);
      message.error('操作失败');
    } finally {
      setSubmitting(false);
    }
  };

  const promotionTypeMap: Record<string, { color: string; text: string }> = {
    full_discount: { color: 'orange', text: '满减' },
    first_order: { color: 'green', text: '首单立减' },
    discount: { color: 'blue', text: '折扣' },
  };

  const columns = [
    { title: '活动名称', dataIndex: 'name', key: 'name' },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      render: (type: string) => {
        const config = promotionTypeMap[type] || { color: 'default', text: type };
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={status === 'active' ? 'green' : 'default'}>
          {status === 'active' ? '启用' : '禁用'}
        </Tag>
      ),
    },
    {
      title: '有效期',
      key: 'dateRange',
      render: (_: Promotion, record: Promotion) => {
        if (record.startDate && record.endDate) {
          return `${formatTime(record.startDate, 'MM-DD')} ~ ${formatTime(record.endDate, 'MM-DD')}`;
        }
        return '永久';
      },
    },
    {
      title: '操作',
      key: 'action',
      render: (_: Promotion, record: Promotion) => (
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
          <GiftOutlined style={{ marginRight: 8 }} />
          促销管理
        </Title>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadPromotions}>
            刷新
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            新增促销
          </Button>
        </Space>
      </div>

      <Card
        bordered={false}
        style={{
          borderRadius: 8,
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        }}
      >
        <Table columns={columns} dataSource={promotions} rowKey="id" loading={loading} />
      </Card>

      <Modal
        title={editingPromotion ? '编辑促销' : '新增促销'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        confirmLoading={submitting}
        okText="保存"
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="活动名称" rules={[{ required: true, message: '请输入活动名称' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="type" label="活动类型" rules={[{ required: true, message: '请选择活动类型' }]}>
            <Select>
              <Select.Option value="full_discount">满减</Select.Option>
              <Select.Option value="first_order">首单立减</Select.Option>
              <Select.Option value="discount">折扣</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="status" label="状态" initialValue="active">
            <Select>
              <Select.Option value="active">启用</Select.Option>
              <Select.Option value="inactive">禁用</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea />
          </Form.Item>
          <Form.Item name="dateRange" label="有效期">
            <RangePicker style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default PromotionPage;