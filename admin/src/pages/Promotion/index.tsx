import React, { useState, useMemo, useRef } from 'react';
import { Table, Button, Modal, Form, Input, InputNumber, Select, Space, Popconfirm, Typography, Tag, DatePicker, Alert, List } from 'antd';
import { antdMessage as message } from '@/utils/antdApp';
import { EditOutlined, DeleteOutlined, GiftOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { Promotion, checkPromotionConflicts } from '@/services/promotion';
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
import AllShopsScopeAlert from '@/components/AllShopsScopeAlert';
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
const [conflictList, setConflictList] = useState<Promotion[]>([]);
const [checkingConflict, setCheckingConflict] = useState(false);
const [deletingId, setDeletingId] = useState<string | null>(null);
// 与 useCrudModal 同款 ref 守卫：validateFields 是异步的，锁必须在校验「之前」落下，
// 否则连点两次会双双穿透 state 的渲染期旧值造成重复创建。
const submittingRef = useRef(false);

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
  if (submittingRef.current) return;
  submittingRef.current = true;
  // 冲突弹窗打开期间保持上锁，直到用户在弹窗里做出选择才释放
  let keepLocked = false;
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

    const effectiveType = type || editingPromotion?.type || '';
    const effectiveStatus = (rest.status as string) || 'active';

    // 仅启用中的活动才会真正参与算价，停用的不必打扰用户
    if (effectiveStatus === 'active' && effectiveType) {
      setCheckingConflict(true);
      try {
        const result = await checkPromotionConflicts({
          type: effectiveType,
          startTime: data.startDate as string | undefined,
          endTime: data.endDate as string | undefined,
          excludeId: editingPromotion?.id,
          shopId,
        });
        if (result?.hasConflict && result.conflicts?.length) {
          setPendingSubmitData(data);
          setConflictList(result.conflicts);
          setConflictModalVisible(true);
          keepLocked = true;
          return;
        }
      } catch (error) {
        // 冲突检测只是「提醒」，检测本身失败不应该挡住正常保存
        console.warn('促销冲突检测失败，跳过提醒直接保存:', error);
      } finally {
        setCheckingConflict(false);
      }
    }

    await performSubmit(data, !editingPromotion);
  } catch (error) {
    if ((error as { errorFields?: unknown })?.errorFields) return;
    console.error('提交失败:', error);
    if (!isRequestErrorHandled(error)) {
      message.error('操作失败');
    }
  } finally {
    if (!keepLocked) submittingRef.current = false;
  }
};

/** 用户选择「仍然保存」：带着已校验的数据继续提交 */
const handleConflictConfirm = async () => {
  setConflictModalVisible(false);
  const data = pendingSubmitData;
  setPendingSubmitData(null);
  setConflictList([]);
  try {
    if (data) {
      await performSubmit(data, !editingPromotion);
    }
  } finally {
    submittingRef.current = false;
  }
};

/** 用户选择「返回修改」：关掉提示回到表单，释放提交锁 */
const handleConflictCancel = () => {
  setConflictModalVisible(false);
  setPendingSubmitData(null);
  setConflictList([]);
  submittingRef.current = false;
};

/** 有效期展示：缺任一端即为开区间，需要如实告知用户而不是笼统写“永久” */
const formatPromotionRange = (record: Pick<Promotion, 'startDate' | 'endDate'>): string => {
  const { startDate, endDate } = record;
  if (!startDate && !endDate) return '长期有效';
  if (startDate && !endDate) return `${formatTime(startDate)} 起长期有效`;
  if (!startDate && endDate) return `即刻起至 ${formatTime(endDate)}`;
  return `${formatTime(startDate)} ~ ${formatTime(endDate)}`;
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
      render: (_: Promotion, record: Promotion) => formatPromotionRange(record),
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
        icon={<GiftOutlined style={{ marginRight: 'var(--tf-space-2)'}} />}
        title={currentShop?.name ? `促销管理 · ${currentShop.name}` : '促销管理'}
        addText="新增促销"
        onAdd={handleAdd}
        onRefresh={() => promotionsQuery.refetch()}
      />

      <AllShopsScopeAlert />

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
  title="促销时间段重叠提醒"
  open={conflictModalVisible}
  onOk={handleConflictConfirm}
  confirmLoading={submitting}
  onCancel={handleConflictCancel}
  okText="仍然保存"
  cancelText="返回修改"
  width={560}
>
  <Alert
    type="warning"
    showIcon
    message={`检测到 ${conflictList.length} 个同类型活动与当前时间段重叠`}
    description="系统允许多个促销叠加生效，这里只是提醒你确认是否符合预期。"
    style={{ marginBottom: 'var(--tf-space-3)'}}
  />
  <List
    size="small"
    bordered
    dataSource={conflictList}
    renderItem={(item) => (
      <List.Item>
        <List.Item.Meta
          title={
            <Space size={6}>
              <Text strong>{item.name}</Text>
              <Tag color={promotionTypeMap[item.type]?.color || 'default'}>
                {promotionTypeMap[item.type]?.text || item.type}
              </Tag>
            </Space>
          }
          description={
            <Text type="secondary" style={{ fontSize: 'var(--tf-font-xs)' }}>
              {formatPromotionRange(item)}
            </Text>
          }
        />
      </List.Item>
    )}
  />
</Modal>

<Modal
 title={editingPromotion ? '编辑促销' : '新增促销'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={closeModal}
        confirmLoading={submitting || checkingConflict}
        okText="保存"
        width={520}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" disabled={submitting || checkingConflict}>
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
