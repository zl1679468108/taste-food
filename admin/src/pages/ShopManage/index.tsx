import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  InputNumber,
  message,
  Space,
  Popconfirm,
  Typography,
  Switch,
  Drawer,
  TimePicker,
  Checkbox,
  Divider,
  Row,
  Col,
} from 'antd';
import {
  EditOutlined,
  DeleteOutlined,
  ShopOutlined,
  TableOutlined,
} from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import { useModel } from '@umijs/max';
import {
  getShops,
  createShop,
  updateShop,
  updateShopStatus,
  updateBusinessHours,
  deleteShop,
  BusinessDayKey,
  BusinessHours,
  Shop as ShopModel,
} from '@/services/shop';
import { formatTime, formatPrice } from '@/utils/format';
import { DEFAULT_TABLE_PAGINATION, DEFAULT_TABLE_LOCALE } from '@/utils/table';
import PageHeaderActions from '@/components/PageHeaderActions';
import { useCrudModal } from '@/hooks/useCrudModal';
import TableCard from '@/components/TableCard';
import SearchFilterBar from '@/components/SearchFilterBar';
import ShopTablesPanel from '@/components/ShopTablesPanel';
import { useShopContext } from '@/hooks/useShopContext';

const { Text } = Typography;

const DAY_ORDER: BusinessDayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const DAY_LABEL: Record<BusinessDayKey, string> = {
  mon: '周一',
  tue: '周二',
  wed: '周三',
  thu: '周四',
  fri: '周五',
  sat: '周六',
  sun: '周日',
};

type DayDraft = {
  closed: boolean;
  range: [Dayjs, Dayjs] | null;
};

const emptyHours = (): BusinessHours => ({
  sun: [],
  mon: [],
  tue: [],
  wed: [],
  thu: [],
  fri: [],
  sat: [],
});

const defaultHours = (): BusinessHours => {
  const range = [{ start: '10:00', end: '22:00' }];
  return {
    sun: [...range],
    mon: [...range],
    tue: [...range],
    wed: [...range],
    thu: [...range],
    fri: [...range],
    sat: [...range],
  };
};

const hoursToDraft = (hours?: BusinessHours | null): Record<BusinessDayKey, DayDraft> => {
  const source = hours || defaultHours();
  const draft = {} as Record<BusinessDayKey, DayDraft>;
  for (const day of DAY_ORDER) {
    const first = (source[day] || [])[0];
    if (!first) {
      draft[day] = { closed: true, range: null };
    } else {
      draft[day] = {
        closed: false,
        range: [dayjs(first.start, 'HH:mm'), dayjs(first.end, 'HH:mm')],
      };
    }
  }
  return draft;
};

const draftToHours = (draft: Record<BusinessDayKey, DayDraft>): BusinessHours => {
  const result = emptyHours();
  for (const day of DAY_ORDER) {
    const item = draft[day];
    if (item.closed || !item.range) {
      result[day] = [];
      continue;
    }
    const start = item.range[0].format('HH:mm');
    const end = item.range[1].format('HH:mm');
    if (start >= end) {
      throw new Error(`${DAY_LABEL[day]} 开始时间必须早于结束时间`);
    }
    result[day] = [{ start, end }];
  }
  return result;
};

const ShopManagePage: React.FC = () => {
  const { initialState } = useModel('@@initialState');
  const currentUser = initialState?.currentUser;
  const boundShopId = currentUser?.shopId;
  // 平台管理员：role=admin 且无绑定店；商家：role=merchant 或 admin+shopId
  const isPlatformAdmin =
    currentUser?.role === 'admin' && !boundShopId;
  const { loadShops: reloadShopContext } = useShopContext();

  const [shops, setShops] = useState<ShopModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [hoursDraft, setHoursDraft] = useState<Record<BusinessDayKey, DayDraft>>(hoursToDraft());
  const [tablesShop, setTablesShop] = useState<ShopModel | null>(null);

  const loadShops = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getShops();
      const list = res || [];
      // 商家账号只展示本店
      setShops(boundShopId ? list.filter((s) => s.id === boundShopId) : list);
    } catch (error) {
      console.error('加载店铺失败:', error);
    } finally {
      setLoading(false);
    }
  }, [boundShopId]);

  const {
    form,
    visible: modalVisible,
    submitting,
    editing: editingShop,
    openCreate: handleAdd,
    openEdit: openEditBase,
    close: closeModal,
    submit: submitModal,
  } = useCrudModal<ShopModel>({
    onSuccess: async () => {
      await loadShops();
      void reloadShopContext();
    },
    mapRecordToForm: (record) => ({
      ...record,
      deliveryRange: record.deliveryRange ? record.deliveryRange / 1000 : 3,
      deliveryFee: record.deliveryFee != null ? record.deliveryFee / 100 : 5,
      minOrderAmount: record.minOrderAmount != null ? record.minOrderAmount / 100 : 0,
    }),
  });

  const handleEdit = useCallback(
    (record: ShopModel) => {
      setHoursDraft(hoursToDraft(record.businessHours));
      openEditBase(record);
    },
    [openEditBase],
  );

  useEffect(() => {
    loadShops();
  }, [loadShops]);

  const handleDelete = async (id: string) => {
    if (!isPlatformAdmin) {
      message.warning('仅平台管理员可删除店铺');
      return;
    }
    try {
      await deleteShop(id);
      message.success('删除成功');
      loadShops();
      void reloadShopContext();
    } catch (error) {
      console.error('删除店铺失败:', error);
    }
  };

  const handleStatusChange = async (record: ShopModel, checked: boolean) => {
    try {
      await updateShopStatus(record.id, checked ? 'open' : 'closed');
      message.success('状态更新成功');
      loadShops();
      void reloadShopContext();
    } catch (error) {
      console.error('状态更新失败:', error);
    }
  };

  const updateDayDraft = (day: BusinessDayKey, patch: Partial<DayDraft>) => {
    setHoursDraft((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        ...patch,
      },
    }));
  };

  const handleSubmit = () =>
    submitModal({
      create: async (values) => {
        if (!isPlatformAdmin) {
          throw new Error('仅平台管理员可新增店铺');
        }
        const shop = await createShop({
          name: values.name as string,
          description: values.description as string,
          address: values.address as string,
          phone: values.phone as string,
          logoUrl: values.logoUrl as string,
          deliveryRange: Math.round(Number(values.deliveryRange) * 1000),
          deliveryFee: Math.round(Number(values.deliveryFee) * 100),
          minOrderAmount: Math.round(Number(values.minOrderAmount) * 100),
        } as any);
        // 新建后同步营业时段
        try {
          const businessHours = draftToHours(hoursDraft);
          await updateBusinessHours(shop.id, businessHours);
        } catch (e) {
          console.warn('新建店铺营业时段保存失败:', e);
        }
        return shop;
      },
      update: async (id, values) => {
        await updateShop(id, {
          name: values.name as string,
          description: values.description as string,
          address: values.address as string,
          phone: values.phone as string,
          logoUrl: values.logoUrl as string,
          deliveryRange: Math.round(Number(values.deliveryRange) * 1000),
          deliveryFee: Math.round(Number(values.deliveryFee) * 100),
          minOrderAmount: Math.round(Number(values.minOrderAmount) * 100),
        } as any);
        const businessHours = draftToHours(hoursDraft);
        await updateBusinessHours(id, businessHours);
      },
    });

  const filteredShops = useMemo(() => {
    const keyword = searchText.trim().toLowerCase();
    return shops.filter((s) => {
      const matchKeyword =
        !keyword ||
        (s.name || '').toLowerCase().includes(keyword) ||
        (s.address || '').toLowerCase().includes(keyword) ||
        (s.phone || '').includes(keyword);
      const matchStatus = !statusFilter || s.status === statusFilter;
      return matchKeyword && matchStatus;
    });
  }, [shops, searchText, statusFilter]);

  const columns = [
    {
      title: '店铺名称',
      dataIndex: 'name',
      key: 'name',
      width: 180,
      ellipsis: true,
      render: (name: string, record: ShopModel) => (
        <div>
          <Text strong>{name}</Text>
          {record.phone ? (
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {record.phone}
              </Text>
            </div>
          ) : null}
        </div>
      ),
    },
    {
      title: '地址',
      dataIndex: 'address',
      key: 'address',
      width: 200,
      ellipsis: true,
      render: (v: string) => v || '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
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
      width: 110,
      render: (range: number) => `${(range / 1000).toFixed(1)} km`,
    },
    {
      title: '配送费',
      dataIndex: 'deliveryFee',
      key: 'deliveryFee',
      width: 100,
      render: (fee: number) => formatPrice(fee),
    },
    {
      title: '起送价',
      dataIndex: 'minOrderAmount',
      key: 'minOrderAmount',
      width: 100,
      render: (amount: number) => formatPrice(amount),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      render: (time: string) => formatTime(time, 'YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'action',
      width: 220,
      fixed: 'right' as const,
      render: (_: ShopModel, record: ShopModel) => (
        <Space size={0}>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Button
            type="link"
            size="small"
            icon={<TableOutlined />}
            onClick={() => setTablesShop(record)}
          >
            桌台
          </Button>
          {isPlatformAdmin ? (
            <Popconfirm
              title="确认删除该店铺？"
              description="删除后该店铺的所有数据将无法恢复"
              okText="确认删除"
              cancelText="取消"
              okButtonProps={{ danger: true }}
              onConfirm={() => handleDelete(record.id)}
            >
              <Button type="link" size="small" danger icon={<DeleteOutlined />}>
                删除
              </Button>
            </Popconfirm>
          ) : null}
        </Space>
      ),
    },
  ];

  return (
    <div className="tf-page">
      <PageHeaderActions
        icon={<ShopOutlined style={{ marginRight: 8 }} />}
        title={isPlatformAdmin ? '店铺管理' : '我的店铺'}
        addText={isPlatformAdmin ? '新增店铺' : undefined}
        onAdd={isPlatformAdmin ? () => {
          setHoursDraft(hoursToDraft(defaultHours()));
          handleAdd();
        } : undefined}
        onRefresh={loadShops}
      />

      <TableCard>
        {isPlatformAdmin ? (
          <SearchFilterBar
            searchPlaceholder="搜索店铺名 / 地址 / 电话"
            onSearch={setSearchText}
            onSearchClear={() => setSearchText('')}
            filterPlaceholder="按状态筛选"
            filterValue={statusFilter}
            filterOptions={[
              { label: '营业中', value: 'open' },
              { label: '已打烊', value: 'closed' },
            ]}
            onFilterChange={setStatusFilter}
          />
        ) : null}
        <Table
          columns={columns}
          dataSource={filteredShops}
          rowKey="id"
          loading={loading}
          size="small"
          pagination={isPlatformAdmin ? DEFAULT_TABLE_PAGINATION : false}
          locale={DEFAULT_TABLE_LOCALE}
          scroll={{ x: 1100 }}
        />
      </TableCard>

      <Modal
        title={editingShop ? '编辑店铺' : '新增店铺'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={closeModal}
        confirmLoading={submitting}
        okText="保存"
        width={720}
        destroyOnClose
        styles={{ body: { maxHeight: '70vh', overflowY: 'auto' } }}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="店铺名称"
            rules={[
              { required: true, message: '请输入店铺名称' },
              { max: 30, message: '店铺名称不超过 30 字' },
            ]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="description" label="店铺描述" rules={[{ max: 200, message: '描述不超过 200 字' }]}>
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="address" label="店铺地址" rules={[{ max: 100, message: '地址不超过 100 字' }]}>
            <Input />
          </Form.Item>
          <Form.Item
            name="phone"
            label="联系电话"
            rules={[{ pattern: /^1\d{10}$|^0\d{2,3}-?\d{7,8}$/, message: '请输入正确的手机号或座机号' }]}
          >
            <Input placeholder="例如 13800138000 或 010-12345678" />
          </Form.Item>
          <Form.Item name="logoUrl" label="Logo URL" rules={[{ type: 'url', message: '请输入合法的 URL' }]}>
            <Input placeholder="https://..." />
          </Form.Item>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                name="deliveryRange"
                label="配送范围（公里）"
                initialValue={3}
                rules={[{ type: 'number', min: 0.5, max: 20, message: '配送范围 0.5 ~ 20 公里' }]}
              >
                <InputNumber min={0.5} max={20} step={0.5} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="deliveryFee"
                label="配送费（元）"
                initialValue={5}
                rules={[{ type: 'number', min: 0, max: 50, message: '配送费 0 ~ 50 元' }]}
              >
                <InputNumber min={0} max={50} step={0.5} precision={2} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="minOrderAmount"
                label="起送价（元）"
                initialValue={0}
                rules={[{ type: 'number', min: 0, max: 1000, message: '起送价 0 ~ 1000 元' }]}
              >
                <InputNumber min={0} max={1000} step={1} precision={2} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left" plain>
            营业时段
          </Divider>
          <Space direction="vertical" style={{ width: '100%' }} size={8}>
            {DAY_ORDER.map((day) => {
              const draft = hoursDraft[day];
              return (
                <Row key={day} gutter={12} align="middle">
                  <Col span={4}>
                    <Text>{DAY_LABEL[day]}</Text>
                  </Col>
                  <Col span={6}>
                    <Checkbox
                      checked={draft?.closed}
                      onChange={(e) =>
                        updateDayDraft(day, {
                          closed: e.target.checked,
                          range: e.target.checked ? null : draft?.range || [dayjs('10:00', 'HH:mm'), dayjs('22:00', 'HH:mm')],
                        })
                      }
                    >
                      休息
                    </Checkbox>
                  </Col>
                  <Col span={14}>
                    <TimePicker.RangePicker
                      format="HH:mm"
                      value={draft?.range || null}
                      disabled={!!draft?.closed}
                      style={{ width: '100%' }}
                      onChange={(vals) =>
                        updateDayDraft(day, {
                          range: vals && vals[0] && vals[1] ? [vals[0], vals[1]] : null,
                        })
                      }
                    />
                  </Col>
                </Row>
              );
            })}
          </Space>
        </Form>
      </Modal>

      <Drawer
        title={tablesShop ? `桌台与扫码 · ${tablesShop.name}` : '桌台与扫码'}
        open={!!tablesShop}
        onClose={() => setTablesShop(null)}
        width={880}
        destroyOnClose
      >
        {tablesShop ? <ShopTablesPanel shopId={tablesShop.id} compact /> : null}
      </Drawer>
    </div>
  );
};

export default ShopManagePage;
