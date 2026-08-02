import React from 'react';
import { Form, Input, Modal } from 'antd';
import type { FormInstance } from 'antd';
import type { ReasonMode, ReasonModalState } from '../hooks/useReasonModal';

const OK_TEXT: Record<ReasonMode, string> = {
  reject: '确认拒单退款',
  force: '确认强制完成',
  cancel_request_reject: '确认拒绝',
  cancel: '确认取消退款',
};

const EXTRA_TEXT: Record<ReasonMode, string> = {
  cancel_request_reject: '拒绝后订单继续履约，不会退款',
  force: '将跳过定位与拍照，原因会展示给顾客',
  reject: '关单后如已支付将原路退回顾客',
  cancel: '关单后如已支付将原路退回顾客',
};

const PLACEHOLDER: Record<ReasonMode, string> = {
  reject: '请填写拒单原因（必填，将触发退款）',
  force: '请填写强制完成原因（必填）',
  cancel_request_reject: '例如：餐品已制作完成，暂无法取消',
  cancel: '请填写取消原因（必填，将触发退款）',
};

export interface OrderReasonModalProps {
  state: ReasonModalState | null;
  form: FormInstance<{ reason: string }>;
  submitting: boolean;
  onCancel: () => void;
  onOk: () => void;
}

const OrderReasonModal: React.FC<OrderReasonModalProps> = ({
  state,
  form,
  submitting,
  onCancel,
  onOk,
}) => {
  const mode = state?.mode;

  return (
    <Modal
      title={state?.title || '填写原因'}
      open={!!state?.open}
      onCancel={onCancel}
      onOk={onOk}
      confirmLoading={submitting}
      destroyOnHidden
      okText={mode ? OK_TEXT[mode] : OK_TEXT.cancel}
      cancelText="取消"
    >
      <Form form={form} layout="vertical" requiredMark>
        <Form.Item
          name="reason"
          label="原因"
          extra={mode ? EXTRA_TEXT[mode] : EXTRA_TEXT.cancel}
          rules={[
            { required: true, message: '请填写原因' },
            { whitespace: true, message: '请填写原因' },
            { min: 2, message: '原因至少 2 个字' },
          ]}
        >
          <Input.TextArea
            rows={4}
            maxLength={200}
            showCount
            placeholder={mode ? PLACEHOLDER[mode] : PLACEHOLDER.cancel}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default OrderReasonModal;
