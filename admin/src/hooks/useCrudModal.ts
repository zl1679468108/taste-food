import { useCallback, useState } from 'react';
import { Form, FormInstance, message } from 'antd';

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
      try {
        let values = await form.validateFields();
        if (handlers.transformValues) {
          values = await handlers.transformValues(values, editing);
        }
        setSubmitting(true);
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
        console.error('提交失败:', error);
        message.error('操作失败');
      } finally {
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
