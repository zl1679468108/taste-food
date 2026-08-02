import React, { useCallback, useState } from 'react';
import { useShopContext } from '@/hooks/useShopContext';
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  InputNumber,
  Switch,
  Space,
  Popconfirm,
  Tag,
  Empty,
} from 'antd';
import { antdMessage as message } from '@/utils/antdApp';
import { EditOutlined, DeleteOutlined, PlusOutlined, MinusCircleOutlined } from '@ant-design/icons';
import PageHeaderActions from '@/components/PageHeaderActions';
import AllShopsScopeAlert from '@/components/AllShopsScopeAlert';
import TableCard from '@/components/TableCard';
import SearchFilterBar from '@/components/SearchFilterBar';
import { useCrudModal } from '@/hooks/useCrudModal';
import { useKeywordFilter } from '@/hooks/useKeywordFilter';
import { DEFAULT_TABLE_PAGINATION, DEFAULT_TABLE_LOCALE } from '@/utils/table';
import {
  useSpecGroups,
  useCreateSpecGroup,
  useUpdateSpecGroup,
  useDeleteSpecGroup,
  SpecGroup,
} from '@/hooks/queries';
import type { SpecGroupOptionInput } from '@/services/menu';
import { brand } from '@/theme';

/** 表单内的选项行：价格以「元」输入，提交前转「分」 */
interface OptionFormRow {
  id?: string;
  name: string;
  priceAdjustYuan?: number;
  isDefault?: boolean;
}

interface SpecGroupFormValues {
  name: string;
  isRequired?: boolean;
  maxSelect?: number;
  options?: OptionFormRow[];
}

/** 分 → 元，用于回填表单 */
const centsToYuan = (cents: number): number => Math.round(cents) / 100;
/** 元 → 分，避免浮点误差 */
const yuanToCents = (yuan?: number): number => Math.round((Number(yuan) || 0) * 100);

/** 选项加价展示：+¥3.00 / -¥1.50 / 不加价 */
const renderPriceAdjust = (cents: number): string => {
  if (!cents) return '不加价';
  const sign = cents > 0 ? '+' : '-';
  return `${sign}¥${(Math.abs(cents) / 100).toFixed(2)}`;
};

const SpecGroupPage: React.FC = () => {
  const { shopId, ready } = useShopContext();
  const enabled = ready && !!shopId;
  const [keyword, setKeyword] = useState('');

  const specGroupsQuery = useSpecGroups(enabled ? shopId : '');
  const createSpecGroup = useCreateSpecGroup();
  const updateSpecGroup = useUpdateSpecGroup();
  const deleteSpecGroup = useDeleteSpecGroup();

  const specGroups = specGroupsQuery.data ?? [];
  const loading = specGroupsQuery.isPending;
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // 关键词命中规格组名称，或其任一选项名称
  const filteredGroups = useKeywordFilter<SpecGroup>(specGroups, keyword, [
    'name',
    (group) => (group.options || []).map((opt) => opt.name).join(' '),
  ]);

  const refresh = useCallback(() => {
    specGroupsQuery.refetch();
  }, [specGroupsQuery]);

  const {
    form,
    visible: modalVisible,
    submitting,
    editing: editingSpec,
    openCreate: handleAdd,
    openEdit: handleEdit,
    close: closeModal,
    submit: submitModal,
  } = useCrudModal<SpecGroup>({
    mapRecordToForm: (record) => ({
      name: record.name,
      isRequired: record.isRequired,
      maxSelect: record.maxSelect,
      options: (record.options || []).map<OptionFormRow>((opt) => ({
        id: opt.id,
        name: opt.name,
        priceAdjustYuan: centsToYuan(opt.priceAdjust),
        isDefault: opt.isDefault,
      })),
    }),
  });

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await deleteSpecGroup.mutateAsync(id);
      message.success('规格组删除成功');
      refresh();
    } catch (error) {
      console.error('删除失败:', error);
    } finally {
      setDeletingId(null);
    }
  };

  /** 表单值 → 接口入参：过滤空行、元转分 */
  const buildOptions = (rows?: OptionFormRow[]): SpecGroupOptionInput[] =>
    (rows || [])
      .filter((row) => row?.name?.trim())
      .map((row) => ({
        id: row.id,
        name: row.name.trim(),
        priceAdjust: yuanToCents(row.priceAdjustYuan),
        isDefault: !!row.isDefault,
      }));

  const handleSubmit = () =>
    submitModal({
      create: (values) => {
        const v = values as unknown as SpecGroupFormValues;
        return createSpecGroup.mutateAsync({
          shopId,
          name: v.name,
          isRequired: v.isRequired ?? true,
          maxSelect: v.maxSelect || 1,
          options: buildOptions(v.options),
        });
      },
      update: (id, values) => {
        const v = values as unknown as SpecGroupFormValues;
        return updateSpecGroup.mutateAsync({
          id,
          data: {
            name: v.name,
            isRequired: v.isRequired,
            maxSelect: v.maxSelect,
            options: buildOptions(v.options),
          },
        });
      },
    });

  const columns = [
    {
      title: '规格组名称',
      dataIndex: 'name',
      key: 'name',
      width: 180,
    },
    {
      title: '必选',
      dataIndex: 'isRequired',
      key: 'isRequired',
      width: 80,
      render: (val: boolean) =>
        val ? <Tag color="red">必选</Tag> : <Tag>可选</Tag>,
    },
    {
      title: '最多选',
      dataIndex: 'maxSelect',
      key: 'maxSelect',
      width: 80,
    },
    {
      title: '规格选项',
      key: 'options',
      render: (_: unknown, record: SpecGroup) => {
        const options = record.options || [];
        if (options.length === 0) {
          return <span style={{ color: brand.textTertiary }}>未配置选项</span>;
        }
        return (
          <Space size={[4, 4]} wrap>
            {options.map((opt) => (
              <Tag key={opt.id} color={opt.isDefault ? 'orange' : undefined}>
                {opt.name}
                {opt.priceAdjust ? ` ${renderPriceAdjust(opt.priceAdjust)}` : ''}
              </Tag>
            ))}
          </Space>
        );
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      render: (_: unknown, record: SpecGroup) => (
        <Space size="middle">
          <Button type="link" icon={<EditOutlined />} onClick={() => handleEdit(record)} size="small">
            编辑
          </Button>
          <Popconfirm
            title="确认删除"
            description="删除后该规格组及其选项无法恢复"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
            okButtonProps={{ loading: deletingId === record.id }}
          >
            <Button type="link" danger icon={<DeleteOutlined />} size="small">
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 'var(--tf-space-6)' }}>
      <PageHeaderActions
        title="规格组管理"
        extra={[
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd} key="add">
            新增规格组
          </Button>,
        ]}
      />

      <AllShopsScopeAlert />

      <SearchFilterBar
        searchPlaceholder="搜索规格组或选项名称"
        onSearch={setKeyword}
      />

      <TableCard>
        <Table
          columns={columns}
          dataSource={filteredGroups}
          rowKey="id"
          loading={loading}
          pagination={DEFAULT_TABLE_PAGINATION}
          locale={DEFAULT_TABLE_LOCALE}
          scroll={{ x: 800 }}
        />
      </TableCard>

      <Modal
        title={editingSpec ? '编辑规格组' : '新增规格组'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={closeModal}
        confirmLoading={submitting}
        width={720}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" initialValues={{ isRequired: true, maxSelect: 1 }}>
          <Form.Item
            name="name"
            label="规格组名称"
            rules={[{ required: true, message: '请输入规格组名称' }]}
          >
            <Input placeholder="如：份量、甜度、辣度" maxLength={20} />
          </Form.Item>

          <Space size="large" align="start">
            <Form.Item name="isRequired" label="必选" valuePropName="checked" tooltip="必选时顾客下单必须选择一项">
              <Switch />
            </Form.Item>

            <Form.Item
              name="maxSelect"
              label="最多可选"
              rules={[{ type: 'number', min: 1, message: '至少可选 1 项' }]}
            >
              <InputNumber min={1} max={10} style={{ width: 120 }} />
            </Form.Item>
          </Space>

          <Form.Item
            label="规格选项"
            required
            tooltip="顾客点餐时可选择的具体规格，如「大份 +3 元」"
          >
            <Form.List
              name="options"
              rules={[
                {
                  validator: async (_, options) => {
                    if (!options || options.length === 0) {
                      return Promise.reject(new Error('请至少添加一个规格选项'));
                    }
                    return Promise.resolve();
                  },
                },
              ]}
            >
              {(fields, { add, remove }, { errors }) => (
                <>
                  {fields.length === 0 && (
                    <Empty
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                      description="尚未添加选项"
                      style={{ margin: 'var(--tf-space-3) 0' }}
                    />
                  )}
                  {fields.map(({ key, name, ...restField }) => (
                    <Space
                      key={key}
                      align="baseline"
                      style={{ display: 'flex', marginBottom: 'var(--tf-space-2)' }}
                    >
                      {/* 隐藏字段：保留已有选项 id，避免编辑时被当作新增而丢失关联 */}
                      <Form.Item {...restField} name={[name, 'id']} hidden>
                        <Input />
                      </Form.Item>

                      <Form.Item
                        {...restField}
                        name={[name, 'name']}
                        rules={[{ required: true, message: '请输入选项名称' }]}
                        style={{ marginBottom: 0 }}
                      >
                        <Input placeholder="选项名，如：大份" style={{ width: 200 }} maxLength={20} />
                      </Form.Item>

                      <Form.Item
                        {...restField}
                        name={[name, 'priceAdjustYuan']}
                        style={{ marginBottom: 0 }}
                      >
                        <InputNumber
                          placeholder="加价"
                          precision={2}
                          step={0.5}
                          addonBefore="¥"
                          style={{ width: 160 }}
                        />
                      </Form.Item>

                      <Form.Item
                        {...restField}
                        name={[name, 'isDefault']}
                        valuePropName="checked"
                        style={{ marginBottom: 0 }}
                      >
                        <Switch checkedChildren="默认" unCheckedChildren="默认" />
                      </Form.Item>

                      <MinusCircleOutlined
                        onClick={() => remove(name)}
                        style={{ color: brand.textTertiary }}
                      />
                    </Space>
                  ))}

                  <Button
                    type="dashed"
                    onClick={() => add({ name: '', priceAdjustYuan: 0, isDefault: false })}
                    block
                    icon={<PlusOutlined />}
                  >
                    添加选项
                  </Button>
                  <Form.ErrorList errors={errors} />
                </>
              )}
            </Form.List>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default SpecGroupPage;
