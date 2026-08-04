/**
 * §3.23 / T246.10 PC 后台「到店核销」中心
 *
 * 能力：
 *   1. 显示本店 status=ready_for_pickup 的待取餐订单（自取 + 堂食）
 *   2. 每行「核销」按钮 → POST /api/orders/:id/verify → ready_for_pickup → completed
 *   3. 输入订单 ID 直接核销（兜底扫码不可用场景）
 *   4. 优先尝试 BarcodeDetector 浏览器原生扫码 → 不支持时降级输入框
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Button, Empty, Form, Input, Space, Table, Tag, Tooltip } from 'antd';
import { CameraOutlined, ReloadOutlined, ScanOutlined, ShopOutlined } from '@ant-design/icons';
import { antdMessage } from '@/utils/antdApp';
import { DeliveryType, OrderStatus } from '@taste-food/shared/constants';
import { useOrders, useVerifyPickup } from '@/hooks/queries/useOrderQueries';

const DELIVERY_TYPE_LABEL: Record<string, string> = {
  [DeliveryType.PICKUP]: '到店自取',
  [DeliveryType.DINE_IN]: '堂食',
};
import { useShopContext } from '@/hooks/useShopContext';
import { DEFAULT_PAGE_SIZE } from '@/utils/table';
import PageHeaderActions from '@/components/PageHeaderActions';
import TableCard from '@/components/TableCard';
import SearchFilterBar from '@/components/SearchFilterBar';
import type { Order } from '@/services/order';

interface BarcodeDetectorCtor {
  new (options?: { formats?: string[] }): {
    detect(source: CanvasImageSource): Promise<Array<{ rawValue: string }>>;
  };
}

declare global {
  interface Window {
    BarcodeDetector?: BarcodeDetectorCtor;
  }
}

const isLikelyOrderId = (s: string) => {
  // 我们的订单 ID 是 UUID 形式（36 字符带连字符），且二维码内容即订单 ID 原样
  // 兼容顾客订单号 TF2026080300010001、UUID、订单详情 ID
  const trimmed = (s || '').trim();
  if (!trimmed) return false;
  return true;
};

const PickupVerifyCenter: React.FC = () => {
  const { shopId, ready } = useShopContext();
  const [keyword, setKeyword] = useState('');
  const [manualId, setManualId] = useState('');
  const [scannerSupported, setScannerSupported] = useState(false);

  // 待取餐订单列表（status=ready_for_pickup）
  const listQuery = useOrders({
    shopId: ready ? shopId : '',
    status: OrderStatus.READY_FOR_PICKUP,
    page: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    keyword: keyword || undefined,
  });
  const pendingOrders = listQuery.data?.items ?? [];
  const total = listQuery.data?.total ?? 0;

  const verifyMutation = useVerifyPickup();

  useEffect(() => {
    if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
      setScannerSupported(true);
    } else {
      setScannerSupported(false);
    }
  }, []);

  /** 扫码核销：弹出 prompt 让用户选择图片（BarcodeDetector 检测文件/视频流） */
  const startScan = () => {
    if (!scannerSupported) {
      antdMessage.warning('当前浏览器不支持原生扫码，请使用下方输入订单 ID 核销');
      return;
    }
    // 简单实现：唤起文件选择，让用户选一张含二维码的图片
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment';
    input.onchange = async (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = url;
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error('图片加载失败'));
        });
        const detector = new window.BarcodeDetector!({ formats: ['qr_code'] });
        const codes = await detector.detect(img);
        URL.revokeObjectURL(url);
        if (codes.length === 0) {
          antdMessage.error('未识别到二维码');
          return;
        }
        const decoded = codes[0].rawValue;
        if (!isLikelyOrderId(decoded)) {
          antdMessage.error('二维码内容不是有效订单 ID');
          return;
        }
        await runVerify(decoded);
      } catch (err) {
        console.error('扫码失败', err);
        antdMessage.error('扫码失败，请改用输入订单 ID 核销');
      }
    };
    input.click();
  };

  const runVerify = async (orderId: string) => {
    const id = orderId.trim();
    if (!id) {
      antdMessage.warning('请输入订单 ID');
      return;
    }
    try {
      await verifyMutation.mutateAsync(id);
      antdMessage.success('核销成功，订单已完成');
      setManualId('');
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || '核销失败';
      antdMessage.error(msg);
    }
  };

  const handleManualSubmit = async () => {
    await runVerify(manualId);
  };

  const columns = useMemo(
    () => [
      {
        title: '订单',
        dataIndex: 'id',
        key: 'id',
        width: 220,
        render: (_: string, order: Order) => (
          <Space direction='vertical' size={2}>
            <span style={{ fontWeight: 500 }}>{order.orderNo || order.id}</span>
            <span style={{ fontSize: 12, color: '#888' }}>ID: {order.id}</span>
          </Space>
        ),
      },
      {
        title: '配送类型',
        dataIndex: 'deliveryType',
        key: 'deliveryType',
        width: 100,
        render: (v: string) => (
          <Tag color={v === 'dine_in' ? 'geekblue' : 'orange'}>
            {DELIVERY_TYPE_LABEL[v] || v}
          </Tag>
        ),
      },
      {
        title: '桌号',
        dataIndex: 'tableNo',
        key: 'tableNo',
        width: 100,
        render: (v?: string) => v || '—',
      },
      {
        title: '菜品',
        dataIndex: 'items',
        key: 'items',
        render: (items: Order['items']) => {
          if (!items?.length) return '—';
          const preview = items
            .slice(0, 3)
            .map((i) => `${i.name}×${i.quantity}`)
            .join('，');
          const more = items.length > 3 ? ` 等 ${items.length} 项` : '';
          return (
            <Tooltip title={items.map((i) => `${i.name}×${i.quantity}`).join('，')}>
              <span>{preview + more}</span>
            </Tooltip>
          );
        },
      },
      {
        title: '金额',
        dataIndex: 'total',
        key: 'total',
        width: 100,
        render: (v: number) => `¥${((v || 0) / 100).toFixed(2)}`,
      },
      {
        title: '操作',
        key: 'action',
        width: 120,
        render: (_: unknown, order: Order) => (
          <Button
            type='primary'
            size='small'
            icon={<ScanOutlined />}
            loading={verifyMutation.isPending && verifyMutation.variables === order.id}
            onClick={() => runVerify(order.id)}
          >
            核销
          </Button>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [verifyMutation],
  );

  return (
    <div style={{ padding: 24 }}>
      <PageHeaderActions
        title='到店核销'
        extra={
          <Space>
            <Button
              icon={<CameraOutlined />}
              onClick={startScan}
              type={scannerSupported ? 'primary' : 'default'}
            >
              扫码核销
            </Button>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => listQuery.refetch()}
              loading={listQuery.isFetching}
            >
              刷新
            </Button>
          </Space>
        }
      />
      <div style={{ marginBottom: 16, color: '#888' }}>
        <Space>
          <Tag icon={<ShopOutlined />} color='orange'>
            {ready ? '本店' : '加载中...'}
          </Tag>
          <span>自取/堂食订单在「待取餐」状态可一键核销，状态推进至已完成</span>
        </Space>
      </div>

      <div style={{ marginBottom: 16, padding: 16, background: '#fafafa', borderRadius: 8 }}>
        <Form layout='inline' onFinish={handleManualSubmit}>
          <Form.Item label='输入订单 ID 核销' style={{ flex: 1 }}>
            <Input
              placeholder='输入订单 ID（顾客二维码内容）后回车'
              value={manualId}
              onChange={(e) => setManualId(e.target.value)}
              allowClear
              style={{ minWidth: 320 }}
            />
          </Form.Item>
          <Form.Item>
            <Button
              htmlType='submit'
              type='primary'
              ghost
              icon={<ScanOutlined />}
              loading={verifyMutation.isPending}
              disabled={!manualId.trim()}
            >
              立即核销
            </Button>
          </Form.Item>
        </Form>
        {!scannerSupported ? (
          <div style={{ marginTop: 8, fontSize: 12, color: '#999' }}>
            当前浏览器不支持 BarcodeDetector，请用上方输入框核销
          </div>
        ) : null}
      </div>

      <SearchFilterBar
        searchValue={keyword}
        onSearch={setKeyword}
        searchPlaceholder='搜索订单号 / ID / 顾客'
      />

      <TableCard>
        <Table<Order>
          rowKey='id'
          columns={columns}
          dataSource={pendingOrders}
          loading={listQuery.isPending}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description='暂无待取餐订单'
              />
            ),
          }}
          pagination={{
            current: 1,
            pageSize: DEFAULT_PAGE_SIZE,
            total,
            showTotal: (t: number) => `共 ${t} 单`,
            onChange: () => {
              /* 单页够用：核销即移除 */
            },
            simple: true,
          }}
          summary={() => (
            <Table.Summary.Row>
              <Table.Summary.Cell index={0} colSpan={columns.length}>
                <span style={{ color: '#888' }}>
                  共 {total} 单待核销。核销后订单状态推进「已完成」，支持顾客评价与售后
                </span>
              </Table.Summary.Cell>
            </Table.Summary.Row>
          )}
        />
      </TableCard>
    </div>
  );
};

export default PickupVerifyCenter;
