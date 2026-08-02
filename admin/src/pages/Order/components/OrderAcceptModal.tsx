import React from 'react';
import { Button, Form, Modal, Radio } from 'antd';
import type { FormInstance } from 'antd';
import type { AcceptModalState } from '../hooks/useAcceptModal';

const ETA_OPTIONS = [
  { label: '15 分钟', value: 15 },
  { label: '20 分钟', value: 20 },
  { label: '30 分钟', value: 30 },
] as const;

export interface OrderAcceptModalProps {
  state: AcceptModalState | null;
  form: FormInstance<{ estimatedMinutes?: number }>;
  submitting: boolean;
  onCancel: () => void;
  onOk: () => void;
}

const OrderAcceptModal: React.FC<OrderAcceptModalProps> = ({
  state,
  form,
  submitting,
  onCancel,
  onOk,
}) => (
  <Modal
    title="确认接单"
    open={!!state?.open}
    onCancel={onCancel}
    onOk={onOk}
    confirmLoading={submitting}
    destroyOnHidden
    okText="确认接单"
    cancelText="取消"
  >
    <Form form={form} layout="vertical" initialValues={{ estimatedMinutes: 20 }}>
      <Form.Item
        name="estimatedMinutes"
        label="预计出餐时间（可选）"
        extra="不选则不传预计分钟；默认推荐 20 分钟"
      >
        <Radio.Group optionType="button" buttonStyle="solid" options={[...ETA_OPTIONS]} />
      </Form.Item>
      <Button
        type="link"
        style={{ padding: 0 }}
        onClick={() => form.setFieldsValue({ estimatedMinutes: undefined })}
      >
        不设置预计时间
      </Button>
    </Form>
  </Modal>
);

export default OrderAcceptModal;
