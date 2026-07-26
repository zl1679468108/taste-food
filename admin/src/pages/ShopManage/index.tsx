import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Table, Button, Modal, Form, Input, InputNumber, message, Space, Popconfirm, Typography, Switch } from 'antd';
import { EditOutlined, DeleteOutlined, ShopOutlined } from '@ant-design/icons';
import {
  getShops,
  createShop,
  updateShop,
  updateShopStatus,
  deleteShop,
  Shop as ShopModel,
} from '@/services/shop';
import { formatTime, formatPrice } from '@/utils/format';
import { DEFAULT_TABLE_PAGINATION, DEFAULT_TABLE_LOCALE } from '@/utils/table';
import PageHeaderActions from '@/components/PageHeaderActions';
import { useCrudModal } from '@/hooks/useCrudModal';
import TableCard from '@/components/TableCard';
import SearchFilterBar from '@/components/SearchFilterBar';

const { Text } = Typography;

const ShopManagePage: React.FC = () => {
  const [shops, setShops] = useState<ShopModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | undefined>();

  const loadShops = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getShops();
      setShops(res || []);
    } catch (error) {
      console.error('加载店铺失败:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const {
    form,
    visible: modalVisible,
    submitting,
    editing: editingShop,
    openCreate: handleAdd,
    openEdit: handleEdit,
    close: closeModal,
    submit: submitModal,
  } = useCrudModal<ShopModel>({
    onSuccess: loadShops,
    mapRecordToForm: (record) => ({
      ...record,
      deliveryRange: record.deliveryRange ? record.deliveryRange / 1000 : 3,
      deliveryFee: record.deliveryFee != null ? record.deliveryFee / 100 : 5,
      minOrderAmount: record.minOrderAmount != null ? record.minOrderAmount / 100 : 0,
    }),
  });

  useEffect(() => {
    loadShops();
  }, [loadShops]);

  const handleDelete = async (id: string) => {
    try {
      await deleteShop(id);
      message.success('删除成功');
      loadShops();
    } catch (error) {
      console.error('删除店铺失败:', error);
    }
  };

  const handleStatusChange = async (record: ShopModel, checked: boolean) => {
    try {
      await updateShopStatus(record.id, checked ? 'open' : 'closed');
      message.success('状态更新成功');
      loadShops();
    } catch (error) {
      console.error('状态更新失败:', error);
    }
  };

  const handleSubmit = () =>
    submitModal({
      create: (values) =>
        createShop({
          ...values,
          deliveryRange: Math.round(Number(values.deliveryRange) * 1000),
          deliveryFee: Math.round(Number(values.deliveryFee) * 100),
          minOrderAmount: Math.round(Number(values.minOrderAmount) * 100),
        } as any),
      update: (id, values) =>
        updateShop(id, {
          ...values,
          deliveryRange: Math.round(Number(values.deliveryRange) * 1000),
          deliveryFee: Math.round(Number(values.deliveryFee) * 100),
          minOrderAmount: Math.round(Number(values.minOrderAmount) * 100),
        } as any),
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
      width: 150,
      fixed: 'right' as const,
      render: (_: ShopModel, record: ShopModel) => (
        <Space size={0}>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            编辑
          </Button>
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
        </Space>
      ),
    },
  ];

  return (
    <div className="tf-page">
      <PageHeaderActions
        icon={<ShopOutlined style={{ marginRight: 8 }} />}
        title="店铺管理"
        addText="新增店铺"
        onAdd={handleAdd}
        onRefresh={loadShops}
      />

      <TableCard>
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
        <Table
          columns={columns}
          dataSource={filteredShops}
          rowKey="id"
          loading={loading}
          size="small"
          pagination={DEFAULT_TABLE_PAGINATION}
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
        width={600}
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
          <Form.Item
            name="deliveryRange"
            label="配送范围（公里）"
            initialValue={3}
            rules={[{ type: 'number', min: 0.5, max: 20, message: '配送范围 0.5 ~ 20 公里' }]}
          >
            <InputNumber min={0.5} max={20} step={0.5} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name="deliveryFee"
            label="配送费（元）"
            initialValue={5}
            rules={[{ type: 'number', min: 0, max: 50, message: '配送费 0 ~ 50 元' }]}
          >
            <InputNumber min={0} max={50} step={0.5} precision={2} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name="minOrderAmount"
            label="起送价（元）"
            initialValue={0}
            rules={[{ type: 'number', min: 0, max: 1000, message: '起送价 0 ~ 1000 元' }]}
          >
            <InputNumber min={0} max={1000} step={1} precision={2} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ShopManagePage;
