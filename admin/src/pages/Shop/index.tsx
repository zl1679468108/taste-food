import React, { useEffect, useMemo, useState } from 'react';
import {
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
  Empty,
  TimePicker,
  Checkbox,
} from 'antd';
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
  CopyOutlined,
} from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import {
  BusinessDayKey,
  BusinessHours,
  Shop,
} from '@/services/shop';
import { useShop, useUpdateShop, useUpdateShopStatus, useUpdateBusinessHours } from '@/hooks/queries';
import { useShopContext } from '@/hooks/useShopContext';
import { formatPrice } from '@/utils/format';
import PageHeaderActions from '@/components/PageHeaderActions';
import TableCard from '@/components/TableCard';
import StatisticCard from '@/components/StatisticCard';
import { brand } from '@/theme';
import MediaPicker from '@/components/MediaPicker';
import ShopLogo from '@/components/ShopLogo';

const { Text, Title } = Typography;

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
  const { shopId, ready, loadShops: reloadShopContext } = useShopContext();
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [hoursDraft, setHoursDraft] = useState<Record<BusinessDayKey, DayDraft>>(hoursToDraft());
  const [form] = Form.useForm();

  const shopQuery = useShop(ready && shopId ? shopId : '');
  const shop: Shop | null = shopQuery.data ?? null;
  const loading = shopQuery.isPending;
  const loadError = shopQuery.isError;

  const updateShopMutation = useUpdateShop();
  const updateStatusMutation = useUpdateShopStatus();
  const updateHoursMutation = useUpdateBusinessHours();
  const saving = updateStatusMutation.isPending;
  const editSaving = updateShopMutation.isPending;
  const hoursSaving = updateHoursMutation.isPending;

  // 营业时段是本地可编辑草稿。依赖序列化后的内容而非 shop 对象身份，
  // 避免窗口聚焦触发的后台 refetch 覆盖用户正在编辑的草稿
  const businessHoursKey = shop?.businessHours ? JSON.stringify(shop.businessHours) : '';
  useEffect(() => {
    if (!businessHoursKey) return;
    setHoursDraft(hoursToDraft(JSON.parse(businessHoursKey) as BusinessHours));
  }, [businessHoursKey]);

  const handleStatusChange = async (checked: boolean) => {
    if (!shop) return;
    try {
      await updateStatusMutation.mutateAsync({
        id: shop.id || shopId,
        status: checked ? 'open' : 'closed',
      });
      message.success('状态更新成功');
      void reloadShopContext();
    } catch (error) {
      console.error('状态更新失败:', error);
    }
  };

  const handleEdit = () => {
    form.setFieldsValue({
      name: shop?.name || '',
      description: shop?.description || '',
      address: shop?.address || '',
      latitude: shop?.latitude,
      longitude: shop?.longitude,
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
      await updateShopMutation.mutateAsync({
        id: shop?.id || shopId,
        data: {
          name: values.name,
          description: values.description,
          address: values.address,
          latitude: values.latitude === '' || values.latitude == null ? undefined : Number(values.latitude),
          longitude: values.longitude === '' || values.longitude == null ? undefined : Number(values.longitude),
          phone: values.phone,
          logoUrl: values.logoUrl,
          deliveryRange: Math.round(values.deliveryRange * 1000),
          deliveryFee: Math.round(values.deliveryFee * 100),
          minOrderAmount: Math.round(values.minOrderAmount * 100),
        },
      });
      message.success('保存成功');
      setEditModalVisible(false);
      void reloadShopContext();
    } catch (error) {
      if ((error as { errorFields?: unknown })?.errorFields) return;
      console.error('保存失败:', error);
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

  const cloneDayDraft = (draft: DayDraft): DayDraft => ({
    closed: draft.closed,
    range: draft.range ? [draft.range[0].clone(), draft.range[1].clone()] : null,
  });

  // 仅本地草稿填充：把周一的休息状态与时段复制到周二-周日，不调用接口
  const applyMondayToRestOfWeek = () => {
    const monday = hoursDraft.mon;
    if (!monday) return;
    if (!monday.closed && !monday.range) {
      message.warning('请先设置周一的营业时间或勾选休息');
      return;
    }
    setHoursDraft((prev) => {
      const source = cloneDayDraft(prev.mon);
      const next = { ...prev } as Record<BusinessDayKey, DayDraft>;
      for (const day of DAY_ORDER) {
        if (day === 'mon') continue;
        next[day] = cloneDayDraft(source);
      }
      return next;
    });
    message.success('已将周一设置同步到周二至周日（本地草稿，点保存后生效）');
  };

  const handleSaveHours = async () => {
    if (!shop) return;
    try {
      const businessHours = draftToHours(hoursDraft);
      await updateHoursMutation.mutateAsync({
        id: shop.id || shopId,
        businessHours,
      });
      message.success('营业时段已保存');
    } catch (error) {
      // 客户端校验错误需要本地提示；接口错误由拦截器处理
      if (error instanceof Error && error.message.includes('开始时间')) {
        message.error(error.message);
      } else {
        console.error('保存营业时段失败:', error);
      }
    }
  };

  const openHint = useMemo(() => {
    if (!shop) return '-';
    if (shop.isOpenNow) return '当前可下单';
    return shop.nextOpenHint || '休息中';
  }, [shop]);

  return (
    <div className="tf-page">
      <PageHeaderActions
        icon={<ShopOutlined style={{ marginRight: 8 }} />}
        title="店铺信息"
        onRefresh={() => shopQuery.refetch()}
        extra={
          shop ? (
            <Button type="primary" icon={<EditOutlined />} onClick={handleEdit}>
              编辑店铺
            </Button>
          ) : null
        }
      />

      {loadError && !loading ? (
        <TableCard>
          <Empty description="店铺信息加载失败" image={Empty.PRESENTED_IMAGE_SIMPLE}>
            <Button type="primary" icon={<ReloadOutlined />} onClick={() => shopQuery.refetch()}>
              重新加载
            </Button>
          </Empty>
        </TableCard>
      ) : (
        <>
          <Row gutter={[16, 16]} style={{ marginBottom: 8 }}>
            <Col xs={24} sm={8}>
              <StatisticCard
                title="配送范围"
                value={shop?.deliveryRange != null ? (shop.deliveryRange / 1000).toFixed(1) : '-'}
                suffix={shop ? 'km' : undefined}
                icon={<CarOutlined />}
                color={brand.primary}
                bgColor={brand.primaryLight}
              />
            </Col>
            <Col xs={24} sm={8}>
              <StatisticCard
                title="配送费"
                value={
                  shop?.deliveryFee != null
                    ? formatPrice(shop.deliveryFee).replace('¥', '')
                    : '-'
                }
                suffix={shop ? '元' : undefined}
                icon={<DollarOutlined />}
                color={brand.success}
                bgColor={brand.successSoft}
              />
            </Col>
            <Col xs={24} sm={8}>
              <StatisticCard
                title="起送价"
                value={
                  shop?.minOrderAmount != null
                    ? formatPrice(shop.minOrderAmount).replace('¥', '')
                    : '-'
                }
                suffix={shop ? '元' : undefined}
                icon={<ShoppingCartOutlined />}
                color={brand.warning}
                bgColor={brand.warningSoft}
              />
            </Col>
          </Row>

          <TableCard>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 16,
                gap: 12,
                flexWrap: 'wrap',
              }}
            >
              <div>
                <Title level={5} style={{ margin: 0 }}>
                  基本信息
                </Title>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  当前店铺 ID：{shop?.id || shopId}
                </Text>
              </div>
              <Space wrap>
                <Switch
                  checked={shop?.status === 'open'}
                  onChange={handleStatusChange}
                  loading={saving}
                  disabled={!shop || loading}
                  checkedChildren="营业中"
                  unCheckedChildren="已打烊"
                />
                <Tag
                  color={shop?.status === 'open' ? 'success' : 'error'}
                  icon={shop?.status === 'open' ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
                >
                  {shop?.status === 'open' ? '营业中' : '已打烊'}
                </Tag>
                <Tag color={shop?.isOpenNow ? 'processing' : 'default'}>{openHint}</Tag>
              </Space>
            </div>

            <Descriptions
              column={{ xs: 1, sm: 2 }}
              bordered
              size="small"
              labelStyle={{ width: 110, background: brand.gray50 }}
              contentStyle={{ background: brand.bgCard }}
            >
              <Descriptions.Item label="店铺名称">
                <Text strong>{shop?.name || '-'}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="联系电话">{shop?.phone || '-'}</Descriptions.Item>
              <Descriptions.Item label="店铺描述" span={2}>
                {shop?.description || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="店铺地址" span={2}>
                {shop?.address || '-'}
                {typeof shop?.latitude === 'number' && typeof shop?.longitude === 'number'
                  ? `（${shop.latitude.toFixed(6)}, ${shop.longitude.toFixed(6)}）`
                  : ''}
              </Descriptions.Item>
              <Descriptions.Item label="Logo">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <ShopLogo src={shop?.logoUrl} size={48} preview />
                  {shop?.logoUrl ? (
                    <Text ellipsis style={{ maxWidth: 280 }} title={shop.logoUrl}>
                      {shop.logoUrl}
                    </Text>
                  ) : (
                    <Text type="secondary">默认 Logo</Text>
                  )}
                </div>
              </Descriptions.Item>
              <Descriptions.Item label="配送参数">
                {shop
                  ? `${(shop.deliveryRange / 1000).toFixed(1)} km · 配送费 ${formatPrice(
                      shop.deliveryFee,
                    )} · 起送 ${formatPrice(shop.minOrderAmount)}`
                  : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="营业时段" span={2}>
                <Text type="secondary">{formatHoursSummary(shop?.businessHours)}</Text>
              </Descriptions.Item>
            </Descriptions>
          </TableCard>

          <TableCard>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 12,
                gap: 12,
                flexWrap: 'wrap',
              }}
            >
              <Space>
                <ClockCircleOutlined style={{ color: brand.primary }} />
                <Title level={5} style={{ margin: 0 }}>
                  营业时段
                </Title>
              </Space>
              <Space wrap>
                <Button
                  icon={<CopyOutlined />}
                  onClick={applyMondayToRestOfWeek}
                  disabled={!shop || hoursSaving}
                >
                  同步周一到全周
                </Button>
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
            </div>

            <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
              按星期配置营业时段（每天一段）。勾选「休息」表示当日不营业。可先配好周一，再点「同步周一到全周」批量填充其余天（仅本地草稿）。
            </Text>

            <Space direction="vertical" size={10} style={{ width: '100%' }}>
              {DAY_ORDER.map((day) => {
                const draft = hoursDraft[day];
                return (
                  <Row
                    key={day}
                    gutter={12}
                    align="middle"
                    style={{
                      padding: '10px 12px',
                      background: brand.gray50,
                      borderRadius: brand.radius,
                      border: `1px solid ${brand.gray200}`,
                    }}
                  >
                    <Col xs={24} sm={4}>
                      <Text strong>{DAY_LABEL[day]}</Text>
                    </Col>
                    <Col xs={12} sm={4}>
                      <Checkbox
                        checked={draft.closed}
                        onChange={(e) =>
                          updateDayDraft(day, {
                            closed: e.target.checked,
                            range: e.target.checked ? null : draft.range || [
                              dayjs('10:00', 'HH:mm'),
                              dayjs('22:00', 'HH:mm'),
                            ],
                          })
                        }
                      >
                        休息
                      </Checkbox>
                    </Col>
                    <Col xs={24} sm={16}>
                      <TimePicker.RangePicker
                        format="HH:mm"
                        minuteStep={5}
                        disabled={draft.closed}
                        value={draft.range}
                        style={{ width: '100%', maxWidth: 320 }}
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
          </TableCard>
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
            label="腾讯地图坐标"
            extra="GCJ-02；可填选点结果。若只填地址且服务端配置了 TENCENT_MAP_KEY，将自动地理编码。"
          >
            <Input.Group compact>
              <Form.Item
                name="latitude"
                noStyle
                rules={[
                  {
                    validator: async (_, value) => {
                      if (value === undefined || value === null || value === '') return;
                      const n = Number(value);
                      if (!Number.isFinite(n) || n < -90 || n > 90) {
                        throw new Error('纬度需在 -90 ~ 90');
                      }
                    },
                  },
                ]}
              >
                <Input style={{ width: '50%' }} placeholder="纬度 latitude" allowClear />
              </Form.Item>
              <Form.Item
                name="longitude"
                noStyle
                rules={[
                  {
                    validator: async (_, value) => {
                      if (value === undefined || value === null || value === '') return;
                      const n = Number(value);
                      if (!Number.isFinite(n) || n < -180 || n > 180) {
                        throw new Error('经度需在 -180 ~ 180');
                      }
                    },
                  },
                ]}
              >
                <Input style={{ width: '50%' }} placeholder="经度 longitude" allowClear />
              </Form.Item>
            </Input.Group>
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
            label="店铺 Logo"
            extra="支持从图库选择或单张上传；未上传时前台自动使用默认 Logo"
            rules={[
              {
                validator: async (_, value) => {
                  if (!value) return;
                  try {
                    // eslint-disable-next-line no-new
                    new URL(value);
                  } catch {
                    throw new Error('请选择或上传合法的图片');
                  }
                },
              },
            ]}
          >
            <MediaPicker
              shopId={shop?.id || shopId}
              selectedHint="已选择店铺 Logo"
              emptyHint="尚未上传 Logo，将使用默认店铺图标"
              libraryButtonText="从图库选择 Logo"
            />
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
  );
};

export default ShopPage;
