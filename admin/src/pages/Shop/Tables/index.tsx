import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Space,
  Switch,
  Table,
  Typography,
  message,
  Image,
  Tag,
} from 'antd';
import { PageContainer } from '@ant-design/pro-components';
import {
  ShopTable,
  buildTableQrImageUrl,
  createTable,
  deleteTable,
  listTables,
  seedTables,
  updateTable,
} from '@/services/table';

const DEFAULT_SHOP_ID = '00000000-0000-0000-0000-000000000001';

export default function ShopTablesPage() {
  const shopId = DEFAULT_SHOP_ID;
  const [loading, setLoading] = useState(false);
  const [tables, setTables] = useState<ShopTable[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ShopTable | null>(null);
  const [qrTable, setQrTable] = useState<ShopTable | null>(null);
  const [form] = Form.useForm();

  const load = async () => {
    setLoading(true);
    try {
      const list = await listTables(shopId);
      setTables(Array.isArray(list) ? list : []);
    } catch (e: any) {
      message.error(e?.message || '加载桌台失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const onSubmit = async () => {
    const values = await form.validateFields();
    try {
      if (editing) {
        await updateTable(shopId, editing.id, values);
        message.success('桌台已更新');
      } else {
        await createTable(shopId, values);
        message.success('桌台已创建');
      }
      setOpen(false);
      setEditing(null);
      form.resetFields();
      load();
    } catch (e: any) {
      message.error(e?.message || '保存失败');
    }
  };

  const columns = useMemo(
    () => [
      { title: '桌号', dataIndex: 'tableNo', width: 100 },
      {
        title: '名称',
        dataIndex: 'label',
        render: (v: string) => v || '-',
      },
      { title: '排序', dataIndex: 'sortOrder', width: 80 },
      {
        title: '状态',
        dataIndex: 'active',
        width: 90,
        render: (v: boolean) => (v ? <Tag color="green">启用</Tag> : <Tag>停用</Tag>),
      },
      { title: '扫码 Path', dataIndex: 'scanPath', ellipsis: true },
      {
        title: '操作',
        width: 260,
        render: (_: unknown, row: ShopTable) => (
          <Space>
            <Button
              type="link"
              onClick={() => {
                setEditing(row);
                form.setFieldsValue({
                  tableNo: row.tableNo,
                  label: row.label,
                  sortOrder: row.sortOrder,
                  active: row.active,
                });
                setOpen(true);
              }}
            >
              编辑
            </Button>
            <Button type="link" onClick={() => setQrTable(row)}>
              二维码
            </Button>
            <Popconfirm
              title="确认删除该桌台？"
              onConfirm={async () => {
                try {
                  await deleteTable(shopId, row.id);
                  message.success('已删除');
                  load();
                } catch (e: any) {
                  message.error(e?.message || '删除失败');
                }
              }}
            >
              <Button type="link" danger>
                删除
              </Button>
            </Popconfirm>
          </Space>
        ),
      },
    ],
    [form],
  );

  return (
    <PageContainer
      title="桌台与扫码"
      subTitle="为每桌生成扫码入座 path；顾客扫码后菜单页自动识别桌号并默认堂食"
    >
      <Card>
        <Space style={{ marginBottom: 16 }} wrap>
          <Button
            type="primary"
            onClick={() => {
              setEditing(null);
              form.resetFields();
              form.setFieldsValue({ active: true, sortOrder: tables.length + 1 });
              setOpen(true);
            }}
          >
            新增桌台
          </Button>
          <Button
            onClick={async () => {
              try {
                await seedTables(shopId);
                message.success('已初始化 A01-A10');
                load();
              } catch (e: any) {
                message.error(e?.message || '初始化失败');
              }
            }}
          >
            初始化 A01-A10
          </Button>
          <Button onClick={load}>刷新</Button>
        </Space>

        <Typography.Paragraph type="secondary">
          开发/体验可用普通二维码编码小程序 path。正式上线请在微信公众平台生成「小程序码」，scene 建议
          <Typography.Text code>t=桌号</Typography.Text>（≤32 字符）。
        </Typography.Paragraph>

        <Table
          rowKey="id"
          loading={loading}
          columns={columns as any}
          dataSource={tables}
          pagination={false}
        />
      </Card>

      <Modal
        title={editing ? '编辑桌台' : '新增桌台'}
        open={open}
        onCancel={() => {
          setOpen(false);
          setEditing(null);
        }}
        onOk={onSubmit}
        destroyOnClose
      >
        <Form form={form} layout="vertical" initialValues={{ active: true, sortOrder: 0 }}>
          <Form.Item name="tableNo" label="桌号" rules={[{ required: true, message: '请输入桌号' }]}>
            <Input placeholder="如 A01" maxLength={32} />
          </Form.Item>
          <Form.Item name="label" label="显示名称">
            <Input placeholder="如 靠窗双人桌" maxLength={64} />
          </Form.Item>
          <Form.Item name="sortOrder" label="排序">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="active" label="启用" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={qrTable ? `桌号 ${qrTable.tableNo} 二维码` : '二维码'}
        open={!!qrTable}
        onCancel={() => setQrTable(null)}
        footer={null}
      >
        {qrTable && (
          <Space direction="vertical" style={{ width: '100%' }} align="center">
            <Image width={220} src={buildTableQrImageUrl(qrTable.scanPath)} alt={qrTable.tableNo} />
            <Typography.Text copyable>{qrTable.scanPath}</Typography.Text>
            <Typography.Text type="secondary">
              打印后贴在桌面；顾客用微信扫码打开小程序菜单并自动带桌号
            </Typography.Text>
          </Space>
        )}
      </Modal>
    </PageContainer>
  );
}
