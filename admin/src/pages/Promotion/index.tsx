import React, { useState, useMemo } from 'react';
import { Table, Button, Modal, Form, Input, InputNumber, Select, message, Space, Popconfirm, Typography, Tag, DatePicker } from 'antd';
import { EditOutlined, DeleteOutlined, GiftOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { Promotion } from '@/services/promotion';
import {
  usePromotions,
  useCreatePromotion,
  useUpdatePromotion,
  useDeletePromotion,
} from '@/hooks/queries';
import SearchFilterBar from '@/components/SearchFilterBar';
import { DEFAULT_TABLE_PAGINATION, DEFAULT_TABLE_LOCALE, filterByKeyword } from '@/utils/table';
import { formatTime } from '@/utils/format';
import { useShopContext } from '@/hooks/useShopContext';
import { isRequestErrorHandled } from '@/utils/request';
import PageHeaderActions from '@/components/PageHeaderActions';
import { useCrudModal } from '@/hooks/useCrudModal';
import TableCard from '@/components/TableCard';

const { Text } = Typography;
const { RangePicker } = DatePicker;

type RuleFieldDef = {
  name: 'threshold' | 'discount';
  label: string;
  required: boolean;
  hint: string;
  unit: 'yuan';
};

const RULE_FIELDS_BY_TYPE: Record<string, RuleFieldDef[]> = {
  full_discount: [
    { name: 'threshold', label: '满（元）', required: true, hint: '订单金额达到此值才触发满减', unit: 'yuan' },
    { name: 'discount', label: '减（元）', required: true, hint: '满足条件后减免的金额', unit: 'yuan' },
  ],
  first_order: [
    { name: 'discount', label: '首单立减（元）', required: true, hint: '新用户首单减免的金额', unit: 'yuan' },
  ],
};

const promotionTypeMap: Record<string, { color: string; text: string }> = {
  full_discount: { color: 'orange', text: '满减' },
  first_order: { color: 'green', text: '首单立减' },
};

const PromotionPage: React.FC = () => {
  const { shopId, ready, currentShop } = useShopContext();
  const [searchText, setSearchText] = useState('');
  const [typeFilter, setTypeFilter] = useState<string | undefined>();
  const promotionsQuery = usePromotions(ready && shopId ? shopId : undefined);
  const promotions = promotionsQuery.data ?? [];
  const loading = promotionsQuery.isPending;

  const createPromotionMutation = useCreatePromotion();
  const updatePromotionMutation = useUpdatePromotion();
  const deletePromotionMutation = useDeletePromotion();

const {
  form,
  visible: modalVisible,
  editing: editingPromotion,
  openCreate: handleAdd,
  openEdit: handleEdit,
  close: closeModal,
} = useCrudModal<Promotion>({
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
    onSuccess: async () => {
      await promotionsQuery.refetch();
    },
});

const [submitting, setSubmitting] = useState(false);
const [conflictModalVisible, setConflictModalVisible] = useState(false);
const [pendingSubmitData, setPendingSubmitData] = useState<Record<string, unknown> | null>(null);
const [conflictRecord, setConflictRecord] = useState<Promotion | undefined>();
const [deletingId, setDeletingId] = useState<string | null>(null);

const checkTimeConflict = (record: {
  id?: string;
  type: string;
  status: string;
  startDate?: string;
  endDate?: string;
}): Promotion | undefined => {
  if (loading) return undefined;

  return promotions.find((p) => {
    if (p.id === record.id) return false;
    if (p.type !== record.type) return false;
    if (p.status !== record.status) return false;

    const pStart = p.startDate;
    const pEnd = p.endDate;
    const rStart = record.startDate;
    const rEnd = record.endDate;

    if (!pStart && !pEnd) return true;
    if (!rStart && !rEnd) return true;

        return (pStart ?? '') < (rEnd ?? '') && (pEnd ?? '') > (rStart ?? '');
  });
};

const performSubmit = async (data: Record<string, unknown>, isCreate: boolean) => {
  setSubmitting(true);
  try {
    if (isCreate) {
      await createPromotionMutation.mutateAsync(data);
      message.success('创建成功');
    } else {
      await updatePromotionMutation.mutateAsync({ id: editingPromotion!.id, data, shopId });
      message.success('更新成功');
    }
    closeModal();
    await promotionsQuery.refetch();
  } catch (error) {
    console.error('提交失败:', error);
    if (!isRequestErrorHandled(error)) {
      message.error('操作失败');
    }
  } finally {
    setSubmitting(false);
  }
};

const handleSubmit = async () => {
  try {
    const values = await form.validateFields();
    const { dateRange, type, threshold, discount, ...rest } = values as {
      dateRange?: [dayjs.Dayjs, dayjs.Dayjs];
      type?: string;
      threshold?: number;
      discount?: number;
      [key: string]: unknown;
    };
    const rule: Record<string, number> = {};
    if (typeof threshold === 'number') rule.threshold = Math.round(threshold * 100);
    if (typeof discount === 'number') rule.discount = Math.round(discount * 100);
    const data: Record<string, unknown> = { ...rest, rule };
    if (!editingPromotion) {
      data.type = type;
      data.shopId = shopId;
    }
    if (dateRange && dateRange[0] && dateRange[1]) {
      data.startDate = dateRange[0].toISOString();
      data.endDate = dateRange[1].toISOString();
    }

    const conflict = checkTimeConflict({
      id: editingPromotion?.id,
      type: type || editingPromotion?.type || '',
      status: 'active',
      startDate: data.startDate as string | undefined,
      endDate: data.endDate as string | undefined,
    });

    if (conflict) {
      setPendingSubmitData(data);
      setConflictRecord(conflict);
      setConflictModalVisible(true);
      return;
    }

    await performSubmit(data, !editingPromotion);
  } catch (error) {
    if ((error as { errorFields?: unknown })?.errorFields) return;
    console.error('提交失败:', error);
    if (!isRequestErrorHandled(error)) {
      message.error('操作失败');
    }
  }
};

const handleConflictConfirm = async () => {
  setConflictModalVisible(false);
  if (pendingSubmitData) {
    const data = pendingSubmitData;
    setPendingSubmitData(null);
    setConflictRecord(undefined);
    await performSubmit(data, !!editingPromotion);
  }
};

const selectedType = Form.useWatch('type', form);

const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await deletePromotionMutation.mutateAsync({ id, shopId });
      message.success('删除成功');
    } catch (error) {
      console.error('删除促销失败:', error);
    } finally {
      setDeletingId(null);
    }
  };


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
    {
      title: '活动名称',
      dataIndex: 'name',
      key: 'name',
      width: 180,
      ellipsis: true,
      render: (name: string) => <Text strong>{name || '-'}</Text>,
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 110,
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
    {
      title: '有效期',
      key: 'dateRange',
      width: 160,
      render: (_: Promotion, record: Promotion) => {
        if (record.startDate && record.endDate) {
          return `${formatTime(record.startDate)} ~ ${formatTime(record.endDate)}`;
        }
        return '永久';
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      fixed: 'right' as const,
      render: (_: Promotion, record: Promotion) => (
        <Space size={0}>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Popconfirm
            title="确认删除？"
            okButtonProps={{ danger: true, loading: deletingId === record.id }}
            onConfirm={() => handleDelete(record.id)}
          >
            <Button
              type="link"
              size="small"
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

  const currentRuleFields = selectedType ? RULE_FIELDS_BY_TYPE[selectedType] || [] : [];

const filteredByKeyword = useMemo(
  () => filterByKeyword(promotions, searchText, ['name']),
  [promotions, searchText],
);

const filteredPromotions = useMemo(
  () => filteredByKeyword.filter((p) => !typeFilter || p.type === typeFilter),
  [filteredByKeyword, typeFilter],
);

  return (
    <div className="tf-page">
      <PageHeaderActions
        icon={<GiftOutlined style={{ marginRight: 8 }} />}
        title={currentShop?.name ? `促销管理 · ${currentShop.name}` : '促销管理'}
        addText="新增促销"
        onAdd={handleAdd}
        onRefresh={() => promotionsQuery.refetch()}
      />

      <TableCard>
        <SearchFilterBar
          searchPlaceholder="搜索促销名称"
          onSearch={setSearchText}
          onSearchClear={() => setSearchText('')}
          filterPlaceholder="按类型筛选"
          filterValue={typeFilter}
          filterOptions={[
            { label: '满减', value: 'full_discount' },
            { label: '首单立减', value: 'first_order' },
          ]}
          onFilterChange={setTypeFilter}
        />
        <Table
          columns={columns}
          dataSource={filteredPromotions}
          rowKey="id"
          loading={loading}
          size="small"
          pagination={DEFAULT_TABLE_PAGINATION}
          locale={DEFAULT_TABLE_LOCALE}
          scroll={{ x: 900 }}
        />
</TableCard>

<Modal
  title="时间段冲突警告"
  open={conflictModalVisible}
  onOk={handleConflictConfirm}
  confirmLoading={submitting}
  onCancel={() => setConflictModalVisible(false)}
  okText="仍然创建/更新"
  cancelText="取消"
  width={520}
>
  <p>当前时间段内已有其他<strong>{conflictRecord ? promotionTypeMap[conflictRecord.type]?.text || conflictRecord.type : ''}</strong>活动：</p>
  {conflictRecord && (
    <ul>
      <li>活动名称：{conflictRecord.name}</li>
      <li>有效期：{conflictRecord.startDate && conflictRecord.endDate ? `${formatTime(conflictRecord.startDate)} ~ ${formatTime(conflictRecord.endDate)}` : '永久'}</li>
    </ul>
  )}
  <p style={{ marginTop: 12, color: 'var(--tf-text-tertiary)' }}>如确定要继续创建/更新，请点击"仍然创建/更新"。</p>
</Modal>

<Modal
 title={editingPromotion ? '编辑促销' : '新增促销'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={closeModal}
        confirmLoading={submitting}
        okText="保存"
        width={520}
        destroyOnClose
      >
        <Form form={form} layout="vertical" disabled={submitting}>
          <Form.Item name="name" label="活动名称" rules={[{ required: true, message: '请输入活动名称' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="type" label="活动类型" rules={[{ required: true, message: '请选择活动类型' }]}>
            <Select disabled={!!editingPromotion}>
              <Select.Option value="full_discount">满减</Select.Option>
              <Select.Option value="first_order">首单立减</Select.Option>
            </Select>
          </Form.Item>

          {currentRuleFields.map((field) => (
            <Form.Item
              key={field.name}
              name={field.name}
              label={field.label}
              rules={field.required ? [{ required: true, message: `请输入${field.label}` }] : []}
              extra={<Text type="secondary" style={{ fontSize: 'var(--tf-font-xs)' }}>{field.hint}</Text>}
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
            <Input.TextArea rows={3} />
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
