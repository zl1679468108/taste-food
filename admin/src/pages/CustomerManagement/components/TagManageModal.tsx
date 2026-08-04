import React, { useState } from 'react';
import { Modal, Tag, Input, Button, Space, Popconfirm, Empty, Tooltip } from 'antd';
import { PlusOutlined, DeleteOutlined, CheckOutlined, EditOutlined, CloseOutlined } from '@ant-design/icons';
import { antdMessage as message } from '@/utils/antdApp';
import {
  useShopTags,
  useCreateShopTag,
  useUpdateShopTag,
  useDeleteShopTag,
} from '@/hooks/queries/useCustomerQueries';
import { TAG_COLOR_OPTIONS } from '@/services/customer';

interface TagManageModalProps {
  open: boolean;
  onClose: () => void;
}

const ColorSwatches: React.FC<{
  value: string;
  onChange: (c: string) => void;
}> = ({ value, onChange }) => (
  <Space size={4} wrap>
    {TAG_COLOR_OPTIONS.map((c) => (
      <Tooltip key={c} title={c}>
        <span
          onClick={() => onChange(c)}
          style={{
            display: 'inline-block',
            width: 18,
            height: 18,
            borderRadius: 4,
            background: c,
            cursor: 'pointer',
            border: value === c ? '2px solid #000' : '2px solid transparent',
            boxSizing: 'border-box',
          }}
        />
      </Tooltip>
    ))}
  </Space>
);

const TagManageModal: React.FC<TagManageModalProps> = ({ open, onClose }) => {
  const { data: tags = [], isPending } = useShopTags();
  const createMut = useCreateShopTag();
  const updateMut = useUpdateShopTag();
  const deleteMut = useDeleteShopTag();

  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(TAG_COLOR_OPTIONS[0]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState(TAG_COLOR_OPTIONS[0]);

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) {
      message.warning('请输入标签名');
      return;
    }
    try {
      await createMut.mutateAsync({ name, color: newColor });
      message.success('标签已创建');
      setNewName('');
    } catch (e: any) {
      message.error(e?.message || '创建失败');
    }
  };

  const startEdit = (tag: { id: string; name: string; color: string }) => {
    setEditingId(tag.id);
    setEditName(tag.name);
    setEditColor(tag.color);
  };

  const saveEdit = async (id: string) => {
    const name = editName.trim();
    if (!name) {
      message.warning('标签名不能为空');
      return;
    }
    try {
      await updateMut.mutateAsync({ id, data: { name, color: editColor } });
      message.success('已保存');
      setEditingId(null);
    } catch (e: any) {
      message.error(e?.message || '保存失败');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteMut.mutateAsync(id);
      message.success('标签已删除');
    } catch (e: any) {
      message.error(e?.message || '删除失败');
    }
  };

  return (
    <Modal title="标签管理" open={open} onCancel={onClose} footer={null} width={520}>
      {/* 新建 */}
      <Space.Compact style={{ width: '100%', marginBottom: 16 }}>
        <Input
          placeholder="新建标签名"
          value={newName}
          maxLength={20}
          onChange={(e) => setNewName(e.target.value)}
          onPressEnter={handleCreate}
        />
        <Button
          type="primary"
          icon={<PlusOutlined />}
          loading={createMut.isPending}
          onClick={handleCreate}
        >
          新建
        </Button>
      </Space.Compact>
      <div style={{ marginBottom: 12 }}>
        <ColorSwatches value={newColor} onChange={setNewColor} />
      </div>

      {isPending ? (
        <div style={{ padding: 24, textAlign: 'center' }}>加载中…</div>
      ) : tags.length === 0 ? (
        <Empty description="还没有标签，先新建一个吧" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          {tags.map((tag) =>
            editingId === tag.id ? (
              <div
                key={tag.id}
                style={{
                  border: '1px solid var(--tf-border, #f0f0f0)',
                  borderRadius: 8,
                  padding: 12,
                }}
              >
                <Input
                  value={editName}
                  maxLength={20}
                  onChange={(e) => setEditName(e.target.value)}
                  style={{ marginBottom: 10 }}
                />
                <ColorSwatches value={editColor} onChange={setEditColor} />
                <div style={{ marginTop: 12, textAlign: 'right' }}>
                  <Space>
                    <Button
                      size="small"
                      icon={<CloseOutlined />}
                      onClick={() => setEditingId(null)}
                    >
                      取消
                    </Button>
                    <Button
                      size="small"
                      type="primary"
                      icon={<CheckOutlined />}
                      loading={updateMut.isPending}
                      onClick={() => saveEdit(tag.id)}
                    >
                      保存
                    </Button>
                  </Space>
                </div>
              </div>
            ) : (
              <div
                key={tag.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <Tag color={tag.color} style={{ fontSize: 14, padding: '2px 10px' }}>
                  {tag.name}
                </Tag>
                <Space>
                  <Button
                    size="small"
                    type="text"
                    icon={<EditOutlined />}
                    onClick={() => startEdit(tag)}
                  >
                    编辑
                  </Button>
                  <Popconfirm
                    title="删除标签"
                    description="该标签将从所有顾客上移除，确定删除？"
                    okText="删除"
                    cancelText="取消"
                    okButtonProps={{ danger: true }}
                    onConfirm={() => handleDelete(tag.id)}
                  >
                    <Button size="small" type="text" danger icon={<DeleteOutlined />}>
                      删除
                    </Button>
                  </Popconfirm>
                </Space>
              </div>
            ),
          )}
        </Space>
      )}
    </Modal>
  );
};

export default TagManageModal;
