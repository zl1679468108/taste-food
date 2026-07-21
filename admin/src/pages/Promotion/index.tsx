import React, { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Input, InputNumber, Select, message, Space, Popconfirm, Typography, Tag, DatePicker, Card } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, GiftOutlined, ReloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { getPromotions, createPromotion, updatePromotion, deletePromotion, Promotion } from '@/services/promotion';
import { formatTime } from '@/utils/format';
import { DEFAULT_SHOP_ID } from '@/utils/constants';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

// 各促销类型对应的 rule 字段定义
type RuleFieldDef = {
  name: 'threshold' | 'discount';
  label: string;
  required: boolean;
  /** 字段描述（展示在表单下方） */
  hint: string;
  /** 单位（分 vs 元，统一用元展示，提交时转换为分） */
  unit: 'yuan';
};

const RULE_FIELDS_BY_TYPE: Record<string, RuleFieldDef[]> = {
  // 满减：满 threshold 元减 discount 元
  full_discount: [
    { name: 'threshold', label: '满（元）', required: true, hint: '订单金额达到此值才触发满减', unit: 'yuan' },
    { name: 'discount', label: '减（元）', required: true, hint: '满足条件后减免的金额', unit: 'yuan' },
  ],
  // 首单立减：首单减 discount 元
  first_order: [
    { name: 'discount', label: '首单立减（元）', required: true, hint: '新用户首单减免的金额', unit: 'yuan' },
  ],
  // 折扣：减 discount 元（与首单类似，但所有订单可用）
  discount: [
    { name: 'discount', label: '立减（元）', required: true, hint: '每单减免的金额', unit: 'yuan' },
  ],
};

const PromotionPage: React.FC = () => {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingPromotion, setEditingPromotion] = useState<Promotion | null>(null);
  const [form] = Form.useForm();
  // 监听 type 变化以动态渲染子表单字段
  const selectedType = Form.useWatch('type', form);

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
    // 将 rule 对象拆解到子字段
    const ruleFields: Record<string, number> = {};
    const rule = (record.rule || {}) as Record<string, number>;
    // 数据库存的是分，表单展示用元
    if (typeof rule.threshold === 'number') ruleFields.threshold = rule.threshold / 100;
    if (typeof rule.discount === 'number') ruleFields.discount = rule.discount / 100;

    // RangePicker 使用 dayjs，按本地时区解析 UTC 字符串，提交时再转回 UTC，确保编辑-提交-存储往返一致
    form.setFieldsValue({
      name: record.name,
      type: record.type,
      status: record.status,
      description: record.description,
      dateRange: record.startDate && record.endDate ?
        [dayjs(record.startDate), dayjs(record.endDate)] : null,
      ...ruleFields,
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
      const { dateRange, type, threshold, discount, ...rest } = values;
      setSubmitting(true);

      // 根据 type 组装 rule 对象（金额转分）
      const rule: Record<string, number> = {};
      if (typeof threshold === 'number') rule.threshold = Math.round(threshold * 100);
      if (typeof discount === 'number') rule.discount = Math.round(discount * 100);

      const data: Partial<Promotion> = {
        ...rest,
        type,
        shopId: DEFAULT_SHOP_ID,
        rule,
      };

      // dateRange 是 dayjs 数组；提交时转 ISO UTC 字符串，与后端存储一致
      if (dateRange && dateRange[0] && dateRange[1]) {
        data.startDate = (dateRange[0] as dayjs.Dayjs).toISOString();
        data.endDate = (dateRange[1] as dayjs.Dayjs).toISOString();
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
      if ((error as { errorFields?: unknown })?.errorFields) return; // 表单校验失败，不提示
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

  // 渲染 rule 字段摘要（列表展示用）
  const renderRuleSummary = (record: Promotion): string => {
    const rule = (record.rule || {}) as Record<string, number>;
    if (record.type === 'full_discount') {
      const t = rule.threshold ? (rule.threshold / 100).toFixed(2) : '-';
      const d = rule.discount ? (rule.discount / 100).toFixed(2) : '-';
      return `满 ¥${t} 减 ¥${d}`;
    }
    if (record.type === 'first_order' || record.type === 'discount') {
      const d = rule.discount ? (rule.discount / 100).toFixed(2) : '-';
      return `减 ¥${d}`;
    }
    return '-';
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
      title: '优惠规则',
      key: 'rule',
      render: (_: Promotion, record: Promotion) => renderRuleSummary(record),
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

  // 当前 type 对应的 rule 字段定义
  const currentRuleFields = selectedType ? RULE_FIELDS_BY_TYPE[selectedType] || [] : [];

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
        width={520}
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

          {/* 根据 type 动态渲染 rule 子表单字段 */}
          {currentRuleFields.map((field) => (
            <Form.Item
              key={field.name}
              name={field.name}
              label={field.label}
              rules={field.required ? [{ required: true, message: `请输入${field.label}` }] : []}
              extra={<Text type="secondary" style={{ fontSize: 12 }}>{field.hint}</Text>}
            >
              <InputNumber
                min={0}
                precision={2}
                style={{ width: '100%' }}
                placeholder={`请输入${field.label}`}
              />
            </Form.Item>
          ))}

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
