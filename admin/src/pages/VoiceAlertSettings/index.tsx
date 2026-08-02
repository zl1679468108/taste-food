import React, { useState, useEffect } from 'react';
import {
  Card,
  Radio,
  Button,
  Typography,
  Space,
  Divider,
  Tag,
  Switch,
  Slider,
  InputNumber,
} from 'antd';
import { SoundOutlined, PlayCircleOutlined, SaveOutlined, ReloadOutlined } from '@ant-design/icons';
import { antdMessage as message } from '@/utils/antdApp';
import {
  VOICE_OPTIONS,
  VOICE_KIND_ORDER,
  VOICE_KIND_LABELS,
  type AdminOrderAlertKind,
} from '@/utils/alertPhrases';
import {
  loadVoiceAlertConfig,
  saveVoiceAlertConfig,
  defaultVoiceAlertConfig,
  type VoiceAlertConfig,
  type VoiceAlertSelection,
} from '@/utils/voiceConfig';
import { previewVoicePhrase } from '@/utils/orderAlertSound';

const { Title, Paragraph, Text } = Typography;

const VoiceAlertSettings: React.FC = () => {
  const [config, setConfig] = useState<VoiceAlertConfig>(() => defaultVoiceAlertConfig());
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    loadVoiceAlertConfig()
      .then((cfg) => {
        if (mounted) setConfig(cfg);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const handlePick = (kind: AdminOrderAlertKind, id: string) => {
    setConfig((prev) => ({ ...prev, selection: { ...prev.selection, [kind]: id } }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveVoiceAlertConfig(config);
      message.success('语音播报已保存，新通知将使用所选话术');
    } catch {
      message.error('保存失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    const def = defaultVoiceAlertConfig();
    setConfig(def);
    setSaving(true);
    try {
      await saveVoiceAlertConfig(def);
      message.success('已恢复为系统默认设置');
    } catch {
      message.error('恢复失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  const setField = <K extends keyof VoiceAlertConfig>(key: K, value: VoiceAlertConfig[K]) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div style={{ maxWidth: 920, margin: '0 auto', padding: '8px 4px 40px' }}>
      <Title level={3} style={{ marginBottom: 4 }}>
        <SoundOutlined style={{ marginRight: 8 }} />
        语音播报
      </Title>
      <Paragraph type="secondary" style={{ marginTop: 0 }}>
        每个重要状态系统提供 3 条标准话术，请挑选 1 条作为该状态当前的语音通知。
        设置按当前店铺保存并同步到服务器，换设备/清缓存也不丢失。
      </Paragraph>

      <Card style={{ marginBottom: 16 }}>
        <Space direction="vertical" size={18} style={{ width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <Text strong>启用语音播报</Text>
              <br />
              <Text type="secondary" style={{ fontSize: 12 }}>
                关闭后所有新订单 / 售后事件均不语音提醒
              </Text>
            </div>
            <Switch
              checked={config.enabled}
              onChange={(v) => setField('enabled', v)}
            />
          </div>

          <div>
            <Text strong>播放音量</Text>
            <div style={{ padding: '8px 8px 0' }}>
              <Slider
                min={0}
                max={1}
                step={0.05}
                value={config.volume}
                onChange={(v) => setField('volume', v)}
                tooltip={{ formatter: (v) => `${Math.round((v ?? 0) * 100)}%` }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text strong>重复播报次数</Text>
            <InputNumber
              min={1}
              max={3}
              step={1}
              value={config.repeat}
              onChange={(v) => setField('repeat', typeof v === 'number' ? v : 1)}
              addonAfter="次"
            />
          </div>
        </Space>
      </Card>

      <Space style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<SaveOutlined />} loading={saving || loading} onClick={handleSave}>
          保存设置
        </Button>
        <Button icon={<ReloadOutlined />} onClick={handleReset}>
          恢复默认
        </Button>
      </Space>

      {VOICE_KIND_ORDER.map((kind) => {
        const options = VOICE_OPTIONS[kind] || [];
        const selectedId = config.selection[kind];
        return (
          <Card
            key={kind}
            style={{ marginBottom: 16 }}
            title={
              <Space>
                <Text strong>{VOICE_KIND_LABELS[kind]}</Text>
                <Tag color="blue">3 选 1</Tag>
              </Space>
            }
          >
            <Radio.Group
              value={selectedId}
              onChange={(e) => handlePick(kind, e.target.value)}
              style={{ width: '100%' }}
            >
              <Space direction="vertical" style={{ width: '100%' }} size={10}>
                {options.map((opt) => (
                  <div
                    key={opt.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '10px 12px',
                      borderRadius: 8,
                      border:
                        selectedId === opt.id
                          ? '1px solid #1677ff'
                          : '1px solid #f0f0f0',
                      background: selectedId === opt.id ? '#f0f7ff' : '#fff',
                    }}
                  >
                    <Radio value={opt.id} style={{ flex: '0 0 auto' }} />
                    <Text style={{ flex: 1 }}>{opt.text}</Text>
                    <Button
                      size="small"
                      type="text"
                      icon={<PlayCircleOutlined />}
                      onClick={() => previewVoicePhrase(opt.text)}
                    >
                      试听
                    </Button>
                  </div>
                ))}
              </Space>
            </Radio.Group>
          </Card>
        );
      })}

      <Divider />
      <Paragraph type="secondary" style={{ fontSize: 12 }}>
        提示：语音由温柔桃子音色（豆包）预生成，离线可用；如所选话术的音频文件缺失，将自动降级为浏览器语音合成。
      </Paragraph>
    </div>
  );
};

export default VoiceAlertSettings;
