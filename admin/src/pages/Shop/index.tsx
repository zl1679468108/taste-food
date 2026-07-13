import React, { useEffect, useState } from 'react';
import { Card, Switch, message, Typography, Descriptions, Tag, Space, Button, Form, InputNumber, Modal, Row, Col, Statistic } from 'antd';
import { ShopOutlined, ReloadOutlined, CheckCircleOutlined, CloseCircleOutlined, EditOutlined, CarOutlined, DollarOutlined, ShoppingCartOutlined } from '@ant-design/icons';
import { getShop, updateShopStatus, updateShop, Shop } from '@/services/shop';
import { DEFAULT_SHOP_ID } from '@/utils/constants';
import { formatPrice } from '@/utils/format';

const { Title, Text } = Typography;

const ShopPage: React.FC = () => {
  const [shop, setShop] = useState<Shop | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    loadShop();
  }, []);

  const loadShop = async () => {
    setLoading(true);
    try {
      const res = await getShop(DEFAULT_SHOP_ID);
      setShop(res);
    } catch (error) {
      console.error('加载店铺失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (checked: boolean) => {
    setSaving(true);
    try {
      await updateShopStatus(DEFAULT_SHOP_ID, checked ? 'open' : 'closed');
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
      deliveryRange: shop?.deliveryRange ? shop.deliveryRange / 1000 : 3,
      deliveryFee: shop?.deliveryFee ? shop.deliveryFee / 100 : 5,
      minOrderAmount: shop?.minOrderAmount ? shop.minOrderAmount / 100 : 0,
    });
    setEditModalVisible(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setEditSaving(true);
      await updateShop(DEFAULT_SHOP_ID, {
        deliveryRange: values.deliveryRange * 1000, // 转换为米
        deliveryFee: values.deliveryFee * 100, // 转换为分
        minOrderAmount: values.minOrderAmount * 100, // 转换为分
      });
      message.success('保存成功');
      setEditModalVisible(false);
      loadShop();
    } catch (error) {
      if ((error as any)?.errorFields) return; // 表单校验失败，不提示
      message.error('保存失败');
    } finally {
      setEditSaving(false);
    }
  };

  return (
    <div >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0 }}>
          <ShopOutlined style={{ marginRight: 8 }} />
          店铺管理
        </Title>
        <Button icon={<ReloadOutlined />} onClick={loadShop}>
          刷新
        </Button>
      </div>

      {/* 配送信息卡片 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={8}>
          <Card
            bordered={false}
            style={{ borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
          >
            <Statistic
              title="配送范围"
              value={shop?.deliveryRange ? (shop.deliveryRange / 1000).toFixed(1) : '3.0'}
              suffix="km"
              prefix={<CarOutlined style={{ color: '#1890ff' }} />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card
            bordered={false}
            style={{ borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
          >
            <Statistic
              title="配送费"
              value={shop?.deliveryFee ? formatPrice(shop.deliveryFee).replace('¥', '') : '5.00'}
              suffix="元"
              prefix={<DollarOutlined style={{ color: '#52c41a' }} />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card
            bordered={false}
            style={{ borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
          >
            <Statistic
              title="起送价"
              value={shop?.minOrderAmount ? formatPrice(shop.minOrderAmount).replace('¥', '') : '0.00'}
              suffix="元"
              prefix={<ShoppingCartOutlined style={{ color: '#faad14' }} />}
            />
          </Card>
        </Col>
      </Row>

      {/* 店铺信息 */}
      <Card
        title="店铺信息"
        loading={loading}
        bordered={false}
        style={{ borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
        extra={
          <Button type="primary" icon={<EditOutlined />} onClick={handleEdit}>
            编辑配送设置
          </Button>
        }
      >
        <Descriptions column={2} bordered size="middle">
          <Descriptions.Item label="店铺名称">
            <Text strong>{shop?.name || '-'}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="店铺状态">
            <Space>
              <Switch
                checked={shop?.status === 'open'}
                onChange={handleStatusChange}
                loading={saving}
                checkedChildren="营业中"
                unCheckedChildren="已打烊"
              />
              <Tag
                color={shop?.status === 'open' ? 'success' : 'error'}
                icon={shop?.status === 'open' ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
              >
                {shop?.status === 'open' ? '营业中' : '已打烊'}
              </Tag>
            </Space>
          </Descriptions.Item>
          <Descriptions.Item label="店铺描述" span={2}>
            {shop?.description || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="联系电话">
            {shop?.phone || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="店铺地址" span={2}>
            {shop?.address || '-'}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {/* 编辑配送设置弹窗 */}
      <Modal
        title="配送设置"
        open={editModalVisible}
        onOk={handleSave}
        onCancel={() => setEditModalVisible(false)}
        confirmLoading={editSaving}
        okText="保存"
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="deliveryRange"
            label="配送范围（公里）"
            rules={[{ required: true, message: '请输入配送范围' }]}
          >
            <InputNumber min={0.5} max={20} step={0.5} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name="deliveryFee"
            label="配送费（元）"
            rules={[{ required: true, message: '请输入配送费' }]}
          >
            <InputNumber min={0} max={50} step={0.5} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name="minOrderAmount"
            label="起送价（元）"
            rules={[{ required: true, message: '请输入起送价' }]}
          >
            <InputNumber min={0} max={100} step={5} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ShopPage;