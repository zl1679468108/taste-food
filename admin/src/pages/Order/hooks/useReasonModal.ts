import { useState } from 'react';
import { Form } from 'antd';

/** 需要填写原因的四类操作 */
export type ReasonMode = 'cancel' | 'reject' | 'force' | 'cancel_request_reject';

export interface ReasonModalState {
  open: boolean;
  orderId: string;
  mode: ReasonMode;
  title: string;
}

const REASON_TITLE: Record<ReasonMode, string> = {
  reject: '拒单并退款',
  force: '强制完成原因',
  cancel_request_reject: '拒绝取消申请',
  cancel: '取消并退款',
};

/**
 * 取消 / 拒单 / 强制完成 / 拒绝取消申请的原因输入弹窗状态。
 * 具体执行动作由调用方通过 submit(perform) 注入。
 */
export function useReasonModal() {
  const [state, setState] = useState<ReasonModalState | null>(null);
  const [form] = Form.useForm<{ reason: string }>();
  const [submitting, setSubmitting] = useState(false);

  const open = (orderId: string, mode: ReasonMode) => {
    // 不要在 open 里调用 form.resetFields()：弹窗用 destroyOnHidden，open 时 <Form> 尚未挂载，
    // 提前调用会触发 "useForm is not connected" 告警。destroyOnHidden 会在关闭时卸载并重建表单，
    // 再次打开即为空白，无需手动 reset。
    setState({ open: true, orderId, mode, title: REASON_TITLE[mode] });
  };

  /** 提交中不允许关闭，避免请求在途时弹窗消失 */
  const close = () => {
    if (submitting) return;
    setState(null);
    form.resetFields();
  };

  const submit = async (
    perform: (ctx: { orderId: string; mode: ReasonMode; reason: string }) => Promise<void>,
  ) => {
    if (!state) return;
    try {
      const values = await form.validateFields();
      const reason = values.reason.trim();
      setSubmitting(true);
      await perform({ orderId: state.orderId, mode: state.mode, reason });
      setState(null);
      form.resetFields();
    } catch (error) {
      // 校验失败或接口失败，保持弹窗
      if (error && typeof error === 'object' && 'errorFields' in (error as object)) {
        return;
      }
      console.error('提交原因失败:', error);
    } finally {
      setSubmitting(false);
    }
  };

  return { state, form, submitting, open, close, submit };
}
