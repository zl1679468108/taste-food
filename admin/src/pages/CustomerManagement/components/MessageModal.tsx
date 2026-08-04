import React, { useState } from 'react';
import { Modal, Input, Button, List, Tag, Empty, Typography, Space } from 'antd';
import { SendOutlined, CheckCircleOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { antdMessage as message } from '@/utils/antdApp';
import { useShopMessages, useSendShopMessage } from '@/hooks/queries/useMessageQueries';
import { formatTime } from '@/utils/format';

interface MessageModalProps {
  open: boolean;
  onClose: () => void;
  customerId?: string;
  customerName?: string;
}

const { Text } = Typography;
const MAX_LEN = 500;

const MessageModal: React.FC<MessageModalProps> = ({
  open,
  onClose,
  customerId,
  customerName,
}) => {
  const { data, isPending } = useShopMessages({ toUserId: customerId, pageSize: 50 });
  const sendMut = useSendShopMessage();
  const [content, setContent] = useState('');

  const messages = data?.items || [];

  const handleSend = async () => {
    const text = content.trim();
    if (!text) {
      message.warning('请输入消息内容');
      return;
    }
    if (!customerId) return;
    try {
      await sendMut.mutateAsync({ toUserId: customerId, content: text });
      message.success('已发送给顾客');
      setContent('');
    } catch (e: any) {
      message.error(e?.message || '发送失败');
    }
  };

  return (
    <Modal
      title={`发送站内信 · ${customerName || '顾客'}`}
      open={open}
      onCancel={onClose}
      footer={null}
      width={560}
    >
      {/* 历史消息 */}
      <div style={{ maxHeight: 320, overflowY: 'auto', marginBottom: 16 }}>
        {isPending ? (
          <div style={{ textAlign: 'center', padding: 24 }}>加载中…</div>
        ) : messages.length === 0 ? (
          <Empty description="还没有发送过消息" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <List
            dataSource={messages}
            renderItem={(m) => (
              <List.Item style={{ display: 'block' }}>
                <div
                  style={{
                    background: 'var(--tf-bg-muted, #f5f5f5)',
                    borderRadius: 8,
                    padding: '8px 12px',
                  }}
                >
                  <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {m.content}
                  </div>
                  <div
                    style={{
                      marginTop: 6,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {formatTime(m.createdAt, 'YYYY-MM-DD HH:mm')}
                    </Text>
                    {m.readAt ? (
                      <Tag color="green" style={{ marginRight: 0 }}>
                        <CheckCircleOutlined /> 已读
                      </Tag>
                    ) : (
                      <Tag color="default" style={{ marginRight: 0 }}>
                        <ClockCircleOutlined /> 未读
                      </Tag>
                    )}
                  </div>
                </div>
              </List.Item>
            )}
          />
        )}
      </div>

      {/* 发送区 */}
      <Input.TextArea
        value={content}
        maxLength={MAX_LEN}
        showCount
        rows={3}
        placeholder="输入要发送给该顾客的消息…"
        onChange={(e) => setContent(e.target.value)}
      />
      <div style={{ marginTop: 12, textAlign: 'right' }}>
        <Space>
          <Button onClick={onClose}>关闭</Button>
          <Button
            type="primary"
            icon={<SendOutlined />}
            loading={sendMut.isPending}
            onClick={handleSend}
          >
            发送
          </Button>
        </Space>
      </div>
    </Modal>
  );
};

export default MessageModal;
