import React, { useEffect, useMemo, useState } from 'react';
import { Table, Button, Typography, Tabs, Modal, Descriptions, message, Space, Spin, Popconfirm } from 'antd';
import { EyeOutlined, DownloadOutlined, ShoppingOutlined } from '@ant-design/icons';
import {
  getOrders,
  getOrder,
  updateOrderStatus,
  cancelOrder,
  exportOrders,
  Order,
  OrderExportResult,
} from '@/services/order';
import DeliveryTypeTag from '@/components/DeliveryTypeTag';
import OrderStatusTag from '@/components/OrderStatusTag';
import PriceDisplay from '@/components/PriceDisplay';
import { formatPrice, formatTime, shortOrderId } from '@/utils/format';
import { DEFAULT_SHOP_ID } from '@/utils/constants';
import { DEFAULT_PAGE_SIZE, DEFAULT_TABLE_LOCALE } from '@/utils/table';
import PageHeaderActions from '@/components/PageHeaderActions';
import TableCard from '@/components/TableCard';
import SearchFilterBar from '@/components/SearchFilterBar';
import { brand } from '@/theme';

const { Text } = Typography;

/** 优先业务单号，否则短 id */
function displayOrderNo(order: Pick<Order, 'id' | 'orderNo' | 'order_no'>): string {
  return order.orderNo || order.order_no || shortOrderId(order.id);
}

/** 简易 CSV 行解析（支持引号转义） */
function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      cells.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  cells.push(cur);
  return cells;
}

function parseCsv(csv: string): string[][] {
  const raw = csv.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  return raw
    .split('\n')
    .filter((line) => line.length > 0)
    .map(parseCsvLine);
}

/** CSV → Excel 兼容 HTML 表格（.xls），带表头样式与中文支持 */
function csvToExcelHtmlBlob(csv: string): Blob {
  const rows = parseCsv(csv);
  const escapeHtml = (s: string) =>
    s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const colCount = rows.reduce((max, r) => Math.max(max, r.length), 0) || 1;
  // 经验列宽：单号/地址更宽
  const colWidths = Array.from({ length: colCount }, (_, i) => {
    if (i === 0 || i === 1) return 140;
    if (i === 7 || i === 14) return 200;
    return 100;
  });

  const thead = rows[0]
    ? `<tr>${rows[0]
        .map(
          (c) =>
            `<th style="background:${brand.primary};color:${brand.textInverse};font-weight:bold;border:1px solid ${brand.primaryDark};padding:6px 10px;white-space:nowrap;">${escapeHtml(c)}</th>`,
        )
        .join('')}</tr>`
    : '';

  const tbody = rows
    .slice(1)
    .map(
      (row) =>
        `<tr>${row
          .map(
            (c) =>
              `<td style="border:1px solid #ddd;padding:4px 8px;mso-number-format:'\\@';">${escapeHtml(c)}</td>`,
          )
          .join('')}</tr>`,
    )
    .join('');

  const colGroup = `<colgroup>${colWidths.map((w) => `<col style="width:${w}px" />`).join('')}</colgroup>`;

  const html = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="UTF-8" />
<!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet>
<x:Name>订单</x:Name>
<x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
</x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
<style>
table { border-collapse: collapse; font-family: "Microsoft YaHei", SimSun, Arial, sans-serif; font-size: 12px; }
</style>
</head>
<body>
<table>${colGroup}<thead>${thead}</thead><tbody>${tbody}</tbody></table>
</body>
</html>`;

  return new Blob([`\uFEFF${html}`], {
    type: 'application/vnd.ms-excel;charset=utf-8;',
  });
}

function base64ToBlob(base64: string, mime: string): Blob {
  const pure = base64.includes(',') ? base64.split(',').pop()! : base64;
  const binary = atob(pure);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

function ensureExcelFilename(name?: string): string {
  const fallback = `orders_${new Date().toISOString().slice(0, 10)}.xls`;
  if (!name) return fallback;
  if (/\.csv$/i.test(name)) return name.replace(/\.csv$/i, '.xls');
  if (/\.(xls|xlsx)$/i.test(name)) return name;
  return `${name}.xls`;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function buildExportBlob(data: OrderExportResult): { blob: Blob; filename: string } {
  const filename = ensureExcelFilename(data.xlsxFilename || data.filename);

  if (data.blob instanceof Blob) {
    return { blob: data.blob, filename };
  }

  const b64 = data.xlsxBase64 || data.xlsx || data.base64;
  if (b64) {
    const isXlsx = /\.xlsx$/i.test(filename);
    return {
      blob: base64ToBlob(b64, isXlsx
        ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : 'application/vnd.ms-excel'),
      filename,
    };
  }

  const csv = data.csv || data.content;
  if (csv) {
    return {
      blob: csvToExcelHtmlBlob(csv),
      filename: ensureExcelFilename(filename.replace(/\.xlsx$/i, '.xls')),
    };
  }

  throw new Error('导出结果为空');
}

const OrderPage: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [total, setTotal] = useState(0);
  const [keyword, setKeyword] = useState('');
  const [detailVisible, setDetailVisible] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    loadOrders();
  }, [activeTab, page, pageSize]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const data = await exportOrders({
        status: activeTab || undefined,
        maxRows: 1000,
      });
      const { blob, filename } = buildExportBlob(data);
      downloadBlob(blob, filename);
      message.success(`已导出 ${data.count ?? 0} 条订单`);
    } catch (e) {
      console.error('导出订单失败:', e);
    } finally {
      setExporting(false);
    }
  };

  const loadOrders = async () => {
    setLoading(true);
    try {
      const params: { shop_id: string; status?: string; page: number; pageSize: number } = {
        shop_id: DEFAULT_SHOP_ID,
        page,
        pageSize,
      };
      if (activeTab) {
        params.status = activeTab;
      }
      const res = await getOrders(params);
      setOrders(res?.items || []);
      setTotal(res?.total || 0);
    } catch (error) {
      console.error('加载订单失败:', error);
      setOrders([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetail = async (order: Order) => {
    setSelectedOrder(order);
    setDetailVisible(true);
    setDetailLoading(true);
    try {
      const fullOrder = await getOrder(order.id);
      setSelectedOrder(fullOrder);
    } catch (error) {
      console.error('加载订单详情失败:', error);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleStatusUpdate = async (orderId: string, status: string) => {
    try {
      await updateOrderStatus(orderId, status);
      message.success('状态更新成功');
      loadOrders();
      if (selectedOrder?.id === orderId) {
        try {
          const fresh = await getOrder(orderId);
          setSelectedOrder(fresh);
        } catch {
          // ignore
        }
      }
    } catch (error) {
      console.error('状态更新失败:', error);
    }
  };

  const handleCancelOrder = async (orderId: string) => {
    try {
      await cancelOrder(orderId);
      message.success('订单已取消');
      loadOrders();
      if (selectedOrder?.id === orderId) {
        try {
          const fresh = await getOrder(orderId);
          setSelectedOrder(fresh);
        } catch {
          // ignore
        }
      }
    } catch (error) {
      console.error('取消订单失败:', error);
    }
  };

  const getAvailableActions = (order: Order) => {
    const actions: { label: string; status: string; type: 'primary' | 'danger'; cancel?: boolean }[] = [];

    switch (order.status) {
      case 'pending_payment':
        actions.push({ label: '取消订单', status: 'cancelled', type: 'danger', cancel: true });
        break;
      case 'paid':
        actions.push({ label: '接单', status: 'accepted', type: 'primary' });
        actions.push({ label: '拒单', status: 'rejected', type: 'danger' });
        actions.push({ label: '取消订单', status: 'cancelled', type: 'danger', cancel: true });
        break;
      case 'accepted':
        actions.push({ label: '开始制作', status: 'preparing', type: 'primary' });
        break;
      case 'preparing':
        if (order.deliveryType === 'delivery') {
          actions.push({ label: '开始配送（商家）', status: 'delivering', type: 'primary' });
        } else {
          actions.push({ label: '待取餐（制作完成）', status: 'ready_for_pickup', type: 'primary' });
        }
        break;
      case 'ready_for_pickup':
        actions.push({ label: '确认取餐', status: 'completed', type: 'primary' });
        break;
      case 'delivering':
        actions.push({ label: '确认送达', status: 'completed', type: 'primary' });
        break;
    }

    return actions;
  };

  const filteredOrders = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    if (!kw) return orders;
    return orders.filter((o) => {
      const hay = [
        o.id,
        o.orderNo,
        o.order_no,
        displayOrderNo(o),
        o.contactName,
        o.contactPhone,
        o.tableNo,
        o.address,
        o.remark,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(kw);
    });
  }, [orders, keyword]);

  const columns = [
    {
      title: '订单号',
      dataIndex: 'id',
      key: 'id',
      width: 140,
      render: (_: string, record: Order) => (
        <Text strong style={{ fontFamily: 'monospace' }}>
          {displayOrderNo(record)}
        </Text>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: (status: string) => <OrderStatusTag status={status} />,
    },
    {
      title: '配送方式',
      dataIndex: 'deliveryType',
      key: 'deliveryType',
      width: 110,
      render: (type: string) => <DeliveryTypeTag type={type} />,
    },
    {
      title: '金额',
      dataIndex: 'total',
      key: 'total',
      width: 100,
      render: (total: number) => <PriceDisplay price={total} />,
    },
    {
      title: '时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 140,
      render: (time: string) => formatTime(time, 'MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'action',
      width: 260,
      fixed: 'right' as const,
      render: (_: Order, record: Order) => (
        <Space>
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => handleViewDetail(record)}
          >
            详情
          </Button>
          {getAvailableActions(record).map((action) =>
            action.cancel ? (
              <Popconfirm
                key={action.status}
                title="确认取消该订单？"
                description="取消后不可恢复，已支付订单将进入退款流程"
                okText="确认取消"
                cancelText="再想想"
                okButtonProps={{ danger: true }}
                onConfirm={() => handleCancelOrder(record.id)}
              >
                <Button type="link" danger>
                  {action.label}
                </Button>
              </Popconfirm>
            ) : (
              <Button
                key={action.status}
                type="link"
                danger={action.type === 'danger'}
                onClick={() => handleStatusUpdate(record.id, action.status)}
              >
                {action.label}
              </Button>
            ),
          )}
        </Space>
      ),
    },
  ];

  const tabItems = [
    { key: '', label: '全部' },
    { key: 'pending_payment', label: '待支付' },
    { key: 'paid', label: '已支付' },
    { key: 'accepted', label: '已接单' },
    { key: 'preparing', label: '制作中' },
    { key: 'ready_for_pickup', label: '待自取' },
    { key: 'delivering', label: '配送中' },
    { key: 'completed', label: '已完成' },
    { key: 'cancelled', label: '已取消' },
    { key: 'rejected', label: '已拒单' },
  ];

  return (
    <div className="tf-page">
      <PageHeaderActions
        icon={<ShoppingOutlined style={{ marginRight: 8 }} />}
        title="订单管理"
        onRefresh={loadOrders}
        extra={
          <Button icon={<DownloadOutlined />} loading={exporting} onClick={handleExport}>
            导出 Excel
          </Button>
        }
      />

      <TableCard>
        <Tabs
          activeKey={activeTab}
          onChange={(key) => {
            setActiveTab(key);
            setPage(1);
            setKeyword('');
          }}
          items={tabItems}
          style={{ marginBottom: 8 }}
        />

        <SearchFilterBar
          searchPlaceholder="搜索订单号/联系人/电话"
          onSearch={setKeyword}
          onSearchClear={() => setKeyword('')}
        />

        <Table
          columns={columns}
          dataSource={filteredOrders}
          rowKey="id"
          loading={loading}
          size="small"
          locale={DEFAULT_TABLE_LOCALE}
          scroll={{ x: 900 }}
          pagination={{
            current: page,
            total,
            pageSize,
            onChange: (nextPage, nextPageSize) => {
              setPage(nextPage);
              setPageSize(nextPageSize);
            },
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50'],
            showTotal: (totalCount) => `共 ${totalCount} 条`,
          }}
        />
      </TableCard>

      <Modal
        title="订单详情"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={selectedOrder ? (
          <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
            <Button onClick={() => setDetailVisible(false)}>关闭</Button>
            {getAvailableActions(selectedOrder).map((action) =>
              action.cancel ? (
                <Popconfirm
                  key={action.status}
                  title="确认取消该订单？"
                  description="取消后不可恢复，已支付订单将进入退款流程"
                  okText="确认取消"
                  cancelText="再想想"
                  okButtonProps={{ danger: true }}
                  onConfirm={async () => {
                    await handleCancelOrder(selectedOrder.id);
                  }}
                >
                  <Button danger>{action.label}</Button>
                </Popconfirm>
              ) : (
                <Button
                  key={action.status}
                  type={action.type === 'primary' ? 'primary' : 'default'}
                  danger={action.type === 'danger'}
                  onClick={() => handleStatusUpdate(selectedOrder.id, action.status)}
                >
                  {action.label}
                </Button>
              ),
            )}
          </Space>
        ) : null}
        width={600}
      >
        <Spin spinning={detailLoading}>
          {selectedOrder && (
            <Descriptions column={2} bordered size="middle">
              <Descriptions.Item label="订单号">
                <Text strong style={{ fontFamily: 'monospace' }}>
                  {displayOrderNo(selectedOrder)}
                </Text>
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                <OrderStatusTag status={selectedOrder.status} />
              </Descriptions.Item>
              <Descriptions.Item label="配送方式">
                <DeliveryTypeTag type={selectedOrder.deliveryType} />
              </Descriptions.Item>
              <Descriptions.Item label="金额">
                <Text strong style={{ color: brand.textPrice, fontSize: 16 }}>
                  {formatPrice(selectedOrder.total)}
                </Text>
              </Descriptions.Item>
              <Descriptions.Item label="商品" span={2}>
                {selectedOrder.items?.length
                  ? selectedOrder.items.map((item) => `${item.name} x${item.quantity}`).join('、')
                  : '-'}
              </Descriptions.Item>
              {selectedOrder.address && (
                <Descriptions.Item label="地址" span={2}>{selectedOrder.address}</Descriptions.Item>
              )}
              {selectedOrder.tableNo && (
                <Descriptions.Item label="桌号">{selectedOrder.tableNo}</Descriptions.Item>
              )}
              {selectedOrder.remark && (
                <Descriptions.Item label="备注" span={2}>
                  <Text type="warning">{selectedOrder.remark}</Text>
                </Descriptions.Item>
              )}
              {selectedOrder.invoiceNeeded && (
                <Descriptions.Item label="发票" span={2}>
                  <Text>
                    需要开票
                    {selectedOrder.invoiceTitle
                      ? ` · 抬头：${selectedOrder.invoiceTitle}`
                      : ''}
                    {selectedOrder.invoiceTaxNo
                      ? ` · 税号：${selectedOrder.invoiceTaxNo}`
                      : ''}
                  </Text>
                </Descriptions.Item>
              )}
              {selectedOrder.contactName && (
                <Descriptions.Item label="联系人">{selectedOrder.contactName}</Descriptions.Item>
              )}
              {selectedOrder.contactPhone && (
                <Descriptions.Item label="联系电话">{selectedOrder.contactPhone}</Descriptions.Item>
              )}
              <Descriptions.Item label="创建时间" span={2}>
                {formatTime(selectedOrder.createdAt)}
              </Descriptions.Item>
            </Descriptions>
          )}
        </Spin>
      </Modal>
    </div>
  );
};

export default OrderPage;
