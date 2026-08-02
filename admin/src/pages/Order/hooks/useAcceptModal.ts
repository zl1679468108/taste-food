import { useState } from 'react';
import { Form } from 'antd';

export interface AcceptModalState {
  open: boolean;
  orderId: string;
  targetStatus: string;
}

/** 接单弹窗状态：可选预计出餐分钟数，默认推荐 20 分钟 */
export function useAcceptModal() {
  const [state, setState] = useState<AcceptModalState | null>(null);
  const [form] = Form.useForm<{ estimatedMinutes?: number }>();
  const [submitting, setSubmitting] = useState(false);

  const open = (orderId: string, targetStatus: string) => {
    // 注意：不要在 open 里调用 form.setFieldsValue。
    // 接单弹窗用了 destroyOnHidden，open 时 <Form> 尚未挂载，提前调用会触发
    // "useForm is not connected to any Form element" 告警。默认值改由 <Form initialValues> 在挂载时注入。
    setState({ open: true, orderId, targetStatus });
  };

  const close = () => {
    if (submitting) return;
    setState(null);
    form.resetFields();
  };

  const submit = async (
    perform: (ctx: {
      orderId: string;
      targetStatus: string;
      estimatedMinutes?: number;
    }) => Promise<void>,
  ) => {
    if (!state) return;
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      await perform({
        orderId: state.orderId,
        targetStatus: state.targetStatus,
        estimatedMinutes: values.estimatedMinutes,
      });
      setState(null);
      form.resetFields();
    } catch (error) {
      if (error && typeof error === 'object' && 'errorFields' in (error as object)) {
        return;
      }
      console.error('接单失败:', error);
    } finally {
      setSubmitting(false);
    }
  };

  return { state, form, submitting, open, close, submit };
}
