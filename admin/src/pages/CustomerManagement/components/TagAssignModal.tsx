import React, { useEffect, useState } from 'react';
import { Modal, Tag, Input, Button, Space, Empty, Tooltip } from 'antd';
import { PlusOutlined, CheckOutlined } from '@ant-design/icons';
import { antdMessage as message } from '@/utils/antdApp';
import {
  useShopTags,
  useCustomerTags,
  useSetCustomerTags,
  useCreateShopTag,
} from '@/hooks/queries/useCustomerQueries';
import { TAG_COLOR_OPTIONS } from '@/services/customer';

interface TagAssignModalProps {
  open: boolean;
  onClose: () => void;
  customerId?: string;
  customerName?: string;
}

const ColorSwatches: React.FC<{ value: string; onChange: (c: string) => void }> = ({
  value,
  onChange,
}) => (
  <Space size={4} wrap>
    {TAG_COLOR_OPTIONS.map((c) => (
      <Tooltip key={c} title={c}>
        <span
          onClick={() => onChange(c)}
          style={{
            display: 'inline-block',
            width: 16,
            height: 16,
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

const TagAssignModal: React.FC<TagAssignModalProps> = ({
  open,
  onClose,
  customerId,
  customerName,
}) => {
  const { data: allTags = [] } = useShopTags();
  const { data: currentTags = [] } = useCustomerTags(customerId);
  const setMut = useSetCustomerTags();
  const createMut = useCreateShopTag();

  const [selected, setSelected] = useState<string[]>([]);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(TAG_COLOR_OPTIONS[0]);

  useEffect(() => {
    if (open && customerId) {
      setSelected(currentTags.map((t) => t.id));
    }
  }, [open, customerId, currentTags]);

  const toggle = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const handleQuickCreate = async () => {
    const name = newName.trim();
    if (!name) {
      message.warning('请输入标签名');
      return;
    }
    try {
      const tag = await createMut.mutateAsync({ name, color: newColor });
      setSelected((prev) => [...prev, tag.id]);
      setNewName('');
      message.success('已新建并选中');
    } catch (e: any) {
      message.error(e?.message || '创建失败');
    }
  };

  const handleSave = async () => {
    if (!customerId) return;
    try {
      await setMut.mutateAsync({ id: customerId, tagIds: selected });
      message.success('标签已更新');
      onClose();
    } catch (e: any) {
      message.error(e?.message || '保存失败');
    }
  };

  return (
    <Modal
      title={`为「${customerName || '顾客'}」设置标签`}
      open={open}
      onCancel={onClose}
      okText="保存"
      okButtonProps={{ loading: setMut.isPending }}
      onOk={handleSave}
      width={520}
    >
      {allTags.length === 0 ? (
        <Empty description="还没有标签，先在下方新建" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        <Space size={[8, 12]} wrap style={{ marginTop: 8 }}>
          {allTags.map((tag) => {
            const active = selected.includes(tag.id);
            return (
              <Tag.CheckableTag
                key={tag.id}
                checked={active}
                onChange={() => toggle(tag.id)}
              >
                <span
                  style={{
                    display: 'inline-block',
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: tag.color,
                    marginRight: 6,
                    verticalAlign: 'middle',
                  }}
                />
                {tag.name}
              </Tag.CheckableTag>
            );
          })}
        </Space>
      )}

      <div
        style={{
          marginTop: 20,
          paddingTop: 16,
          borderTop: '1px solid var(--tf-border, #f0f0f0)',
        }}
      >
        <div style={{ marginBottom: 8, color: 'var(--tf-text-secondary)' }}>快速新建并添加</div>
        <Space.Compact style={{ width: '100%' }}>
          <Input
            placeholder="标签名"
            value={newName}
            maxLength={20}
            onChange={(e) => setNewName(e.target.value)}
            onPressEnter={handleQuickCreate}
          />
          <Button
            icon={<PlusOutlined />}
            loading={createMut.isPending}
            onClick={handleQuickCreate}
          >
            新建
          </Button>
        </Space.Compact>
        <div style={{ marginTop: 10 }}>
          <ColorSwatches value={newColor} onChange={setNewColor} />
        </div>
      </div>
    </Modal>
  );
};

export default TagAssignModal;
