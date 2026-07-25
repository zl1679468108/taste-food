import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Table, Button, Modal, Form, Input, InputNumber, Select, message, Space, Popconfirm, Typography, Tag, DatePicker, Card } from 'antd';
import { PageContainer } from '@ant-design/pro-components';
import { PlusOutlined, EditOutlined, DeleteOutlined, GiftOutlined, ReloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { getPromotions, createPromotion, updatePromotion, deletePromotion, Promotion } from '@/services/promotion';
import SearchFilterBar from '@/components/SearchFilterBar';
import { DEFAULT_TABLE_PAGINATION, DEFAULT_TABLE_LOCALE } from '@/utils/table';
import { formatTime } from '@/utils/format';
import { DEFAULT_SHOP_ID } from '@/utils/constants';
import PageHeaderActions from '@/components/PageHeaderActions';
import { useCrudModal } from '@/hooks/useCrudModal';
import TableCard from '@/components/TableCard';

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
};

const PromotionPage: React.FC = () => {
  const [searchText, setSearchText] = useState('');
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);

  const loadPromotions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getPromotions();
      setPromotions(res || []);
    } catch (error) {
      console.error('加载促销失败:', error);
      message.error('加载促销失败');
    } finally {
      setLoading(false);
    }
  }, []);

  const {
    form,
    visible: modalVisible,
    submitting,
    editing: editingPromotion,
    openCreate: handleAdd,
    openEdit: handleEdit,
    close: closeModal,
    submit: submitModal,
  } = useCrudModal<Promotion>({
    onSuccess: loadPromotions,
    mapRecordToForm: (record) => {
      const ruleFields: Record<string, number> = {};
      const rule = (record.rule || {}) as Record<string, number>;
      if (typeof rule.threshold === 'number') ruleFields.threshold = rule.threshold / 100;
      if (typeof rule.discount === 'number') ruleFields.discount = rule.discount / 100;
      return {
        name: record.name,
        type: record.type,
        status: record.status,
        description: record.description,
        dateRange: record.startDate && record.endDate
          ? [dayjs(record.startDate), dayjs(record.endDate)]
          : null,
        ...ruleFields,
      };
    },
  });

  // 监听 type 变化以动态渲染子表单字段
  const selectedType = Form.useWatch('type', form);

  useEffect(() => {
    loadPromotions();
  }, [loadPromotions]);

  const handleDelete = async (id: string) => {
    try {
      await deletePromotion(id);
      message.success('删除成功');
      loadPromotions();
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handleSubmit = () =>
    submitModal({
      transformValues: (values, editing) => {
        const { dateRange, type, threshold, discount, ...rest } = values as any;
        const rule: Record<string, number> = {};
        if (typeof threshold === 'number') rule.threshold = Math.round(threshold * 100);
        if (typeof discount === 'number') rule.discount = Math.round(discount * 100);
        const data: Record<string, unknown> = {
          ...rest,
          rule,
        };
        // 类型和店铺只在创建时提交；更新接口以资源现有值和 JWT 店铺为准。
        if (!editing) {
          data.type = type;
          data.shopId = DEFAULT_SHOP_ID;
        }
        if (dateRange && dateRange[0] && dateRange[1]) {
          data.startDate = (dateRange[0] as dayjs.Dayjs).toISOString();
          data.endDate = (dateRange[1] as dayjs.Dayjs).toISOString();
        }
        return data;
      },
      create: (values) => createPromotion(values as any),
      update: (id, values) => updatePromotion(id, values as any),
    });

  const promotionTypeMap: Record<string, { color: string; text: string }> = {
    full_discount: { color: 'orange', text: '满减' },
    first_order: { color: 'green', text: '首单立减' },
  };

  // 渲染 rule 字段摘要（列表展示用）
  const renderRuleSummary = (record: Promotion): string => {
    const rule = (record.rule || {}) as Record<string, number>;
    if (record.type === 'full_discount') {
      const t = rule.threshold ? (rule.threshold / 100).toFixed(2) : '-';
      const d = rule.discount ? (rule.discount / 100).toFixed(2) : '-';
      return `满 ¥${t} 减 ¥${d}`;
    }
    if (record.type === 'first_order') {
      const d = rule.discount ? (rule.discount / 100).toFixed(2) : '-';
      return `减 ¥${d}`;
    }
    return '-';
  };

  const columns = [
    { title: '活动名称', dataIndex: 'name', key: 'name', width: 160, ellipsis: true },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 100,
      render: (type: string) => {
        const config = promotionTypeMap[type] || { color: 'default', text: type };
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: '优惠规则',
      key: 'rule',
      width: 180,
      ellipsis: true,
      render: (_: Promotion, record: Promotion) => renderRuleSummary(record),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: (status: string) => (
        <Tag color={status === 'active' ? 'green' : 'default'}>
          {status === 'active' ? '启用' : '禁用'}
        </Tag>
      ),
    },
    { title: '有效期', key: 'dateRange', width: 200,
      render: (_: Promotion, record: Promotion) => {
        if (record.startDate && record.endDate) {
          return `${formatTime(record.startDate, 'MM-DD')} ~ ${formatTime(record.endDate, 'MM-DD')}`;
        }
        return '永久';
      },
    },
    { title: '操作', key: 'action', width: 160, render: (_: Promotion, record: Promotion) => (
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

  const filteredPromotions = useMemo(() => {
    if (!searchText.trim()) return promotions;
    return promotions.filter((p) => p.name?.includes(searchText.trim()));
  }, [promotions, searchText]);

  return (
    <PageContainer title="促销管理" subTitle="满减/首单活动">
    <div>
      <PageHeaderActions
      icon={<GiftOutlined style={{ marginRight: 8 }} />}
      title="促销管理"
      addText="新增促销"
      onAdd={handleAdd}
      onRefresh={loadPromotions}
    />

      <TableCard>
              <SearchFilterBar
        searchPlaceholder="搜索促销名称"
        onSearch={setSearchText}
        onSearchClear={() => setSearchText('')}
      />
      <Table columns={columns} dataSource={filteredPromotions} rowKey="id" loading={loading}
        pagination={DEFAULT_TABLE_PAGINATION}
        locale={DEFAULT_TABLE_LOCALE}
        scroll={{ x: 900 }}
      />
      </TableCard>

      <Modal
        title={editingPromotion ? '编辑促销' : '新增促销'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={closeModal}
        confirmLoading={submitting}
        okText="保存"
        width={520}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="活动名称" rules={[{ required: true, message: '请输入活动名称' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="type" label="活动类型" rules={[{ required: true, message: '请选择活动类型' }]}>
            <Select disabled={!!editingPromotion}>
              <Select.Option value="full_discount">满减</Select.Option>
              <Select.Option value="first_order">首单立减</Select.Option>
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
    </PageContainer>
  );
};

export default PromotionPage;
