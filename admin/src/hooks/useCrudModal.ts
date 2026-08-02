import { useCallback, useRef, useState } from 'react';
import { Form, FormInstance } from 'antd';
import { antdMessage as message } from '@/utils/antdApp';
import { isRequestErrorHandled } from '@/utils/request';

export interface UseCrudModalOptions<T> {
  /** 打开编辑时写入表单的字段映射，默认 setFieldsValue(record) */
  mapRecordToForm?: (record: T) => Record<string, unknown>;
  onSuccess?: () => void | Promise<void>;
  createSuccessText?: string;
  updateSuccessText?: string;
}

/**
 * 统一 CRUD Modal 状态：visible / editing / submitting / form / openCreate / openEdit / close / submit
 */
export function useCrudModal<T extends { id: string }>(
  options: UseCrudModalOptions<T> = {},
) {
  const {
    mapRecordToForm,
    onSuccess,
    createSuccessText = '创建成功',
    updateSuccessText = '更新成功',
  } = options;

  const [visible, setVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // ref 守卫：state 在同一 tick 内读到的是渲染期旧值，连点会穿透
  const submittingRef = useRef(false);
  const [editing, setEditing] = useState<T | null>(null);
  const [form] = Form.useForm();

  const openCreate = useCallback(() => {
    setEditing(null);
    form.resetFields();
    setVisible(true);
  }, [form]);

  const openEdit = useCallback(
    (record: T) => {
      setEditing(record);
      form.setFieldsValue(mapRecordToForm ? mapRecordToForm(record) : record);
      setVisible(true);
    },
    [form, mapRecordToForm],
  );

  const close = useCallback(() => {
    setVisible(false);
  }, []);

  const submit = useCallback(
    async (
      handlers: {
        create: (values: Record<string, unknown>) => Promise<unknown>;
        update: (id: string, values: Record<string, unknown>) => Promise<unknown>;
        /** 提交前可改 values（如日期转换） */
        transformValues?: (values: Record<string, unknown>, editing: T | null) => Record<string, unknown> | Promise<Record<string, unknown>>;
      },
    ) => {
      // 校验是异步的，必须在校验「之前」上锁，否则两次快速点击会双双穿透产生重复创建
      if (submittingRef.current) return;
      submittingRef.current = true;
      setSubmitting(true);
      try {
        let values = await form.validateFields();
        if (handlers.transformValues) {
          values = await handlers.transformValues(values, editing);
        }
        if (editing) {
          await handlers.update(editing.id, values);
          message.success(updateSuccessText);
        } else {
          await handlers.create(values);
          message.success(createSuccessText);
        }
        setVisible(false);
        await onSuccess?.();
      } catch (error) {
        if ((error as { errorFields?: unknown })?.errorFields) return;
        // 重复提交被请求层拦截属正常行为，不作为失败提示给用户
        if (isRequestErrorHandled(error)) return;
        console.error('提交失败:', error);
        message.error('操作失败');
      } finally {
        submittingRef.current = false;
        setSubmitting(false);
      }
    },
    [form, editing, onSuccess, createSuccessText, updateSuccessText],
  );

  return {
    form: form as FormInstance,
    visible,
    submitting,
    editing,
    isEdit: !!editing,
    openCreate,
    openEdit,
    close,
    submit,
    setVisible,
  };
}
