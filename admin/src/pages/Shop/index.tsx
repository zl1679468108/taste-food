import React, { useEffect, useMemo, useState } from 'react';
import {
  Card,
  Switch,
  message,
  Typography,
  Descriptions,
  Tag,
  Space,
  Button,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Col,
  Statistic,
  Empty,
  TimePicker,
  Checkbox,
} from 'antd';
import { PageContainer } from '@ant-design/pro-components';
import {
  ShopOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  EditOutlined,
  CarOutlined,
  DollarOutlined,
  ShoppingCartOutlined,
  ClockCircleOutlined,
  SaveOutlined,
} from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import {
  getShop,
  updateShopStatus,
  updateShop,
  updateBusinessHours,
  BusinessDayKey,
  BusinessHours,
  Shop,
} from '@/services/shop';
import { DEFAULT_SHOP_ID } from '@/utils/constants';
import { formatPrice } from '@/utils/format';
import PageHeaderActions from '@/components/PageHeaderActions';
import TableCard from '@/components/TableCard';

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

const formatHoursSummary = (hours?: BusinessHours | null): string => {
  if (!hours) return '未配置（仅看开关店状态）';
  return DAY_ORDER.map((day) => {
    const ranges = hours[day] || [];
    if (ranges.length === 0) return `${DAY_LABEL[day]} 休息`;
    return `${DAY_LABEL[day]} ${ranges.map((r) => `${r.start}-${r.end}`).join(' / ')}`;
  }).join('；');
};

type DayDraft = {
  closed: boolean;
  range: [Dayjs, Dayjs] | null;
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

const ShopPage: React.FC = () => {
  const [shop, setShop] = useState<Shop | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [hoursSaving, setHoursSaving] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [hoursDraft, setHoursDraft] = useState<Record<BusinessDayKey, DayDraft>>(hoursToDraft());
  const [form] = Form.useForm();

  useEffect(() => {
    loadShop();
  }, []);

  const loadShop = async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await getShop(DEFAULT_SHOP_ID);
      setShop(res);
      setHoursDraft(hoursToDraft(res.businessHours));
    } catch (error) {
      console.error('加载店铺失败:', error);
      setShop(null);
      setLoadError(true);
      message.error('加载店铺失败');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (checked: boolean) => {
    if (!shop) return;
    setSaving(true);
    try {
      await updateShopStatus(shop.id || DEFAULT_SHOP_ID, checked ? 'open' : 'closed');
      message.success('状态更新成功');
      loadShop();
    } catch (error) {
      message.error('状态更新失败');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = () => {
    form.setFieldsValue({
      name: shop?.name || '',
      description: shop?.description || '',
      address: shop?.address || '',
      phone: shop?.phone || '',
      logoUrl: shop?.logoUrl || '',
      deliveryRange: shop?.deliveryRange ? shop.deliveryRange / 1000 : 3,
      deliveryFee: shop?.deliveryFee != null ? shop.deliveryFee / 100 : 5,
      minOrderAmount: shop?.minOrderAmount != null ? shop.minOrderAmount / 100 : 0,
    });
    setEditModalVisible(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setEditSaving(true);
      await updateShop(shop?.id || DEFAULT_SHOP_ID, {
        name: values.name,
        description: values.description,
        address: values.address,
        phone: values.phone,
        logoUrl: values.logoUrl,
        deliveryRange: Math.round(values.deliveryRange * 1000),
        deliveryFee: Math.round(values.deliveryFee * 100),
        minOrderAmount: Math.round(values.minOrderAmount * 100),
      });
      message.success('保存成功');
      setEditModalVisible(false);
      loadShop();
    } catch (error) {
      if ((error as { errorFields?: unknown })?.errorFields) return;
      message.error('保存失败');
    } finally {
      setEditSaving(false);
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

  const handleSaveHours = async () => {
    if (!shop) return;
    try {
      const businessHours = draftToHours(hoursDraft);
      setHoursSaving(true);
      await updateBusinessHours(shop.id || DEFAULT_SHOP_ID, businessHours);
      message.success('营业时段已保存');
      loadShop();
    } catch (error) {
      const msg = error instanceof Error ? error.message : '保存营业时段失败';
      message.error(msg);
    } finally {
      setHoursSaving(false);
    }
  };

  const openHint = useMemo(() => {
    if (!shop) return '-';
    if (shop.isOpenNow) return '当前可下单';
    return shop.nextOpenHint || '休息中';
  }, [shop]);

  return (
    <PageContainer title="店铺信息" subTitle="单店基础信息与配送设置">
      <div>
        <PageHeaderActions
          icon={<ShopOutlined style={{ marginRight: 8 }} />}
          title="店铺管理"
          onRefresh={loadShop}
        />

        {loadError && !loading ? (
          <TableCard>
            <Empty
              description="店铺信息加载失败"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            >
              <Button type="primary" icon={<ReloadOutlined />} onClick={loadShop}>
                重新加载
              </Button>
            </Empty>
          </TableCard>
        ) : (
          <>
            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
              <Col xs={24} sm={8}>
                <Card bordered={false} style={{ borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                  <Statistic
                    title="配送范围"
                    value={shop?.deliveryRange != null ? (shop.deliveryRange / 1000).toFixed(1) : '-'}
                    suffix={shop ? 'km' : undefined}
                    prefix={<CarOutlined style={{ color: '#FF6B35' }} />}
                    loading={loading}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={8}>
                <Card bordered={false} style={{ borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                  <Statistic
                    title="配送费"
                    value={shop?.deliveryFee != null ? formatPrice(shop.deliveryFee).replace('¥', '') : '-'}
                    suffix={shop ? '元' : undefined}
                    prefix={<DollarOutlined style={{ color: '#52c41a' }} />}
                    loading={loading}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={8}>
                <Card bordered={false} style={{ borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                  <Statistic
                    title="起送价"
                    value={shop?.minOrderAmount != null ? formatPrice(shop.minOrderAmount).replace('¥', '') : '-'}
                    suffix={shop ? '元' : undefined}
                    prefix={<ShoppingCartOutlined style={{ color: '#faad14' }} />}
                    loading={loading}
                  />
                </Card>
              </Col>
            </Row>

            <Card
              title="店铺信息"
              loading={loading}
              bordered={false}
              style={{ borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 16 }}
              extra={
                <Button type="primary" icon={<EditOutlined />} onClick={handleEdit} disabled={!shop}>
                  编辑店铺
                </Button>
              }
            >
              <Descriptions column={2} bordered size="middle">
                <Descriptions.Item label="店铺名称">
                  <Text strong>{shop?.name || '-'}</Text>
                </Descriptions.Item>
                <Descriptions.Item label="营业状态">
                  <Space>
                    <Switch
                      checked={shop?.status === 'open'}
                      onChange={handleStatusChange}
                      loading={saving}
                      disabled={!shop}
                      checkedChildren="营业中"
                      unCheckedChildren="已打烊"
                    />
                    <Tag
                      color={shop?.status === 'open' ? 'success' : 'error'}
                      icon={shop?.status === 'open' ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
                    >
                      {shop?.status === 'open' ? '营业中' : '已打烊'}
                    </Tag>
                    <Tag color={shop?.isOpenNow ? 'processing' : 'default'}>
                      {shop?.isOpenNow ? '可下单' : '休息中'}
                    </Tag>
                  </Space>
                </Descriptions.Item>
                <Descriptions.Item label="店铺描述" span={2}>
                  {shop?.description || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="联系电话">
                  {shop?.phone || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="Logo">
                  {shop?.logoUrl ? (
                    <Text ellipsis style={{ maxWidth: 240 }} title={shop.logoUrl}>
                      {shop.logoUrl}
                    </Text>
                  ) : (
                    '-'
                  )}
                </Descriptions.Item>
                <Descriptions.Item label="店铺地址" span={2}>
                  {shop?.address || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="配送范围">
                  {shop?.deliveryRange != null ? `${(shop.deliveryRange / 1000).toFixed(1)} km` : '-'}
                </Descriptions.Item>
                <Descriptions.Item label="配送费">
                  {shop?.deliveryFee != null ? formatPrice(shop.deliveryFee) : '-'}
                </Descriptions.Item>
                <Descriptions.Item label="起送价">
                  {shop?.minOrderAmount != null ? formatPrice(shop.minOrderAmount) : '-'}
                </Descriptions.Item>
                <Descriptions.Item label="当前可下单">
                  {openHint}
                </Descriptions.Item>
                <Descriptions.Item label="营业时段概览" span={2}>
                  <Text type="secondary">{formatHoursSummary(shop?.businessHours)}</Text>
                </Descriptions.Item>
              </Descriptions>
            </Card>

            <Card
              title={
                <Space>
                  <ClockCircleOutlined />
                  <span>营业时段</span>
                </Space>
              }
              loading={loading}
              bordered={false}
              style={{ borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
              extra={
                <Space>
                  <Button
                    onClick={() => setHoursDraft(hoursToDraft(shop?.businessHours))}
                    disabled={!shop || hoursSaving}
                  >
                    重置
                  </Button>
                  <Button
                    type="primary"
                    icon={<SaveOutlined />}
                    onClick={handleSaveHours}
                    loading={hoursSaving}
                    disabled={!shop}
                  >
                    保存时段
                  </Button>
                </Space>
              }
            >
              <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
                按星期配置营业时段（每天一段）。勾选「休息」表示当日不营业；开始时间须早于结束时间。
              </Text>
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                {DAY_ORDER.map((day) => {
                  const draft = hoursDraft[day];
                  return (
                    <Row key={day} gutter={12} align="middle">
                      <Col span={3}>
                        <Text strong>{DAY_LABEL[day]}</Text>
                      </Col>
                      <Col span={4}>
                        <Checkbox
                          checked={draft.closed}
                          onChange={(e) =>
                            updateDayDraft(day, {
                              closed: e.target.checked,
                              range: e.target.checked
                                ? null
                                : draft.range || [dayjs('10:00', 'HH:mm'), dayjs('22:00', 'HH:mm')],
                            })
                          }
                        >
                          休息
                        </Checkbox>
                      </Col>
                      <Col span={10}>
                        <TimePicker.RangePicker
                          format="HH:mm"
                          minuteStep={5}
                          disabled={draft.closed}
                          value={draft.range}
                          style={{ width: '100%' }}
                          onChange={(value) =>
                            updateDayDraft(day, {
                              range: value as [Dayjs, Dayjs] | null,
                              closed: false,
                            })
                          }
                        />
                      </Col>
                    </Row>
                  );
                })}
              </Space>
            </Card>
          </>
        )}

        <Modal
          title="编辑店铺"
          open={editModalVisible}
          onOk={handleSave}
          onCancel={() => setEditModalVisible(false)}
          confirmLoading={editSaving}
          okText="保存"
          width={640}
          destroyOnClose
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
              <Input placeholder="请输入店铺名称" />
            </Form.Item>
            <Form.Item
              name="description"
              label="店铺描述"
              rules={[{ max: 200, message: '描述不超过 200 字' }]}
            >
              <Input.TextArea rows={3} placeholder="一句话介绍店铺" />
            </Form.Item>
            <Form.Item
              name="address"
              label="店铺地址"
              rules={[{ max: 100, message: '地址不超过 100 字' }]}
            >
              <Input placeholder="请输入店铺地址" />
            </Form.Item>
            <Form.Item
              name="phone"
              label="联系电话"
              rules={[
                {
                  validator: async (_, value) => {
                    if (!value) return;
                    if (!/^1\d{10}$|^0\d{2,3}-?\d{7,8}$/.test(value)) {
                      throw new Error('请输入正确的手机号或座机号');
                    }
                  },
                },
              ]}
            >
              <Input placeholder="例如 13800138000 或 010-12345678" allowClear />
            </Form.Item>
            <Form.Item
              name="logoUrl"
              label="Logo URL"
              rules={[
                {
                  validator: async (_, value) => {
                    if (!value) return;
                    try {
                      // eslint-disable-next-line no-new
                      new URL(value);
                    } catch {
                      throw new Error('请输入合法的 URL');
                    }
                  },
                },
              ]}
            >
              <Input placeholder="https://...（可选）" allowClear />
            </Form.Item>
            <Row gutter={16}>
              <Col span={8}>
                <Form.Item
                  name="deliveryRange"
                  label="配送范围（公里）"
                  rules={[
                    { required: true, message: '请输入配送范围' },
                    { type: 'number', min: 0.5, max: 20, message: '配送范围 0.5 ~ 20 公里' },
                  ]}
                >
                  <InputNumber min={0.5} max={20} step={0.5} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item
                  name="deliveryFee"
                  label="配送费（元）"
                  rules={[
                    { required: true, message: '请输入配送费' },
                    { type: 'number', min: 0, max: 50, message: '配送费 0 ~ 50 元' },
                  ]}
                >
                  <InputNumber min={0} max={50} step={0.5} precision={2} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item
                  name="minOrderAmount"
                  label="起送价（元）"
                  rules={[
                    { required: true, message: '请输入起送价' },
                    { type: 'number', min: 0, max: 1000, message: '起送价 0 ~ 1000 元' },
                  ]}
                >
                  <InputNumber min={0} max={1000} step={1} precision={2} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            </Row>
          </Form>
        </Modal>
      </div>
    </PageContainer>
  );
};

export default ShopPage;
