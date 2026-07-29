import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  Button,
  Space,
  Segmented,
  Upload,
  Spin,
  Empty,
  Image,
  Popconfirm,
  message,
  Tooltip,
} from 'antd';
import {
  CheckOutlined,
  CloudUploadOutlined,
  DeleteOutlined,
  PictureOutlined,
  ReloadOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import type { UploadProps } from 'antd';
import {
  batchUploadMenuImages,
  deleteMenuImage,
  getMenuImageName,
  isMenuImageUsed,
  listMenuImages,
  type MenuImageAsset,
  uploadMenuImage,
} from '@/services/storage';
import { DEFAULT_SHOP_ID } from '@/utils/constants';
import { isRequestErrorHandled } from '@/utils/request';
import './index.less';

export type MediaPickerFilter = 'all' | 'unused';

export interface MediaPickerModalProps {
  open: boolean;
  shopId?: string;
  /** 当前已选 url，用于高亮 */
  value?: string;
  onCancel: () => void;
  onSelect: (url: string, asset?: MenuImageAsset) => void;
}

const ACCEPT = 'image/jpeg,image/png,image/webp,image/jpg';
const MAX_MB = 5;
const MAX_BATCH = 30;

function validateImageFile(file: File): string | null {
  const okType = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'].includes(file.type);
  if (!okType) return '仅支持 jpg / png / webp 格式';
  if (file.size / 1024 / 1024 >= MAX_MB) return `单张图片不能超过 ${MAX_MB}MB`;
  return null;
}

/**
 * 图库选择弹窗：网格、已用角标、全部/仅未使用、批量导入
 */
export const MediaPickerModal: React.FC<MediaPickerModalProps> = ({
  open,
  shopId = DEFAULT_SHOP_ID,
  value,
  onCancel,
  onSelect,
}) => {
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [assets, setAssets] = useState<MenuImageAsset[]>([]);
  const [filter, setFilter] = useState<MediaPickerFilter>('all');
  const [selectedUrl, setSelectedUrl] = useState<string | undefined>(value);
  const batchInputRef = useRef<HTMLInputElement>(null);

  const loadAssets = useCallback(async () => {
    setLoading(true);
    try {
      const list = await listMenuImages(shopId);
      setAssets(list);
    } catch (error) {
      console.error('加载图库失败:', error);
      setAssets([]);
    } finally {
      setLoading(false);
    }
  }, [shopId]);

  useEffect(() => {
    if (open) {
      setSelectedUrl(value);
      setFilter('all');
      loadAssets();
    }
  }, [open, value, loadAssets]);

  const filteredAssets = useMemo(() => {
    if (filter === 'unused') {
      return assets.filter((item) => !isMenuImageUsed(item));
    }
    return assets;
  }, [assets, filter]);

  const usedCount = useMemo(
    () => assets.filter((item) => isMenuImageUsed(item)).length,
    [assets],
  );

  const runBatchUpload = async (files: File[]) => {
    if (!files.length) return;
    if (files.length > MAX_BATCH) {
      message.error(`单次最多导入 ${MAX_BATCH} 张`);
      return;
    }
    for (const file of files) {
      const err = validateImageFile(file);
      if (err) {
        message.error(`${file.name}: ${err}`);
        return;
      }
    }

    setUploading(true);
    try {
      const result = await batchUploadMenuImages(files, shopId);
      if (result.successCount > 0 && result.failCount > 0) {
        message.warning(`成功 ${result.successCount} 张，失败 ${result.failCount} 张`);
      } else if (result.successCount > 0) {
        message.success(`成功导入 ${result.successCount} 张图片`);
      } else {
        message.error(result.failed[0]?.reason || '批量导入失败');
      }
      await loadAssets();
    } catch (error) {
      console.error('批量导入失败:', error);
      if (!isRequestErrorHandled(error)) {
        message.error('批量导入失败');
      }
    } finally {
      setUploading(false);
    }
  };

  const handleBatchInputChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    await runBatchUpload(files);
  };

  const handleDelete = async (asset: MenuImageAsset) => {
    if (!asset.id) {
      message.warning('无法删除：缺少图片 ID');
      return;
    }
    if (isMenuImageUsed(asset)) {
      message.warning('该图片已被菜品使用，请先解绑后再删除');
      return;
    }
    try {
      await deleteMenuImage(asset.id);
      message.success('已删除');
      if (selectedUrl && selectedUrl === asset.url) {
        setSelectedUrl(undefined);
      }
      await loadAssets();
    } catch (error) {
      console.error('删除图片失败:', error);
      if (!isRequestErrorHandled(error)) {
        message.error('删除失败');
      }
    }
  };

  const handleConfirm = () => {
    if (!selectedUrl) {
      message.warning('请先选择一张图片');
      return;
    }
    const asset = assets.find((item) => item.url === selectedUrl);
    onSelect(selectedUrl, asset);
  };

  const batchImportButton = (
    <Button
      type="primary"
      icon={<CloudUploadOutlined />}
      loading={uploading}
      onClick={() => batchInputRef.current?.click()}
    >
      批量导入
    </Button>
  );

  return (
    <Modal
      title="从图库选择"
      open={open}
      onCancel={onCancel}
      onOk={handleConfirm}
      okText="使用选中图片"
      okButtonProps={{ disabled: !selectedUrl }}
      cancelText="取消"
      width={780}
      destroyOnClose
      className="tf-media-picker-modal"
      styles={{ body: { paddingTop: 12 } }}
    >
      <input
        ref={batchInputRef}
        type="file"
        accept={ACCEPT}
        multiple
        style={{ display: 'none' }}
        onChange={handleBatchInputChange}
      />

      <div className="tf-media-picker-modal__toolbar">
        <div className="tf-media-picker-modal__toolbar-left">
          <Segmented
            value={filter}
            onChange={(v) => setFilter(v as MediaPickerFilter)}
            options={[
              { label: `全部 (${assets.length})`, value: 'all' },
              { label: `仅未使用 (${Math.max(assets.length - usedCount, 0)})`, value: 'unused' },
            ]}
          />
          <span className="tf-media-picker-modal__count">已用 {usedCount} 张</span>
        </div>
        <div className="tf-media-picker-modal__toolbar-right">
          <Button icon={<ReloadOutlined />} onClick={loadAssets} disabled={loading || uploading}>
            刷新
          </Button>
          {batchImportButton}
        </div>
      </div>

      <Spin spinning={loading || uploading}>
        {filteredAssets.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={filter === 'unused' ? '没有未使用的图片' : '图库为空，请先批量导入'}
          >
            <Button
              type="primary"
              icon={<CloudUploadOutlined />}
              loading={uploading}
              onClick={() => batchInputRef.current?.click()}
            >
              批量导入图片
            </Button>
          </Empty>
        ) : (
          <div className="tf-media-picker-modal__grid">
            {filteredAssets.map((asset) => {
              const used = isMenuImageUsed(asset);
              const selected = selectedUrl === asset.url;
              const name = getMenuImageName(asset);
              return (
                <div
                  key={asset.id || asset.url}
                  className={[
                    'tf-media-picker-modal__card',
                    selected ? 'is-selected' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => setSelectedUrl(asset.url)}
                  onDoubleClick={() => onSelect(asset.url, asset)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedUrl(asset.url);
                    }
                  }}
                >
                  <img
                    className="tf-media-picker-modal__card-img"
                    src={asset.url}
                    alt={name || 'menu'}
                    loading="lazy"
                  />
                  <Tooltip
                    title={
                      used
                        ? `已用于：${(asset.usedBy || asset.used_by || [])
                            .map((u) => u.name)
                            .filter(Boolean)
                            .join('、') || '菜品'}`
                        : '未使用'
                    }
                  >
                    <span
                      className={[
                        'tf-media-picker-modal__badge',
                        used ? 'is-used' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                    >
                      {used ? '已用' : '未用'}
                    </span>
                  </Tooltip>
                  {selected ? (
                    <span className="tf-media-picker-modal__check">
                      <CheckOutlined />
                    </span>
                  ) : null}
                  {name ? <div className="tf-media-picker-modal__name">{name}</div> : null}
                  <div
                    className="tf-media-picker-modal__delete"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Popconfirm
                      title="确认删除这张图片？"
                      description={used ? '图片仍被菜品引用，删除可能失败' : undefined}
                      okText="删除"
                      cancelText="取消"
                      okButtonProps={{ danger: true }}
                      onConfirm={() => handleDelete(asset)}
                    >
                      <Tooltip title="删除">
                        <Button size="small" danger shape="circle" icon={<DeleteOutlined />} />
                      </Tooltip>
                    </Popconfirm>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Spin>
    </Modal>
  );
};

export interface MediaPickerProps {
  value?: string;
  onChange?: (url: string) => void;
  shopId?: string;
  /** 是否展示次要「单张上传」入口，默认 true */
  allowSingleUpload?: boolean;
  /** 预览区文案：已选择图片 */
  selectedHint?: string;
  /** 空态文案 */
  emptyHint?: string;
  /** 图库按钮文案 */
  libraryButtonText?: string;
}

/**
 * 菜品图片字段：主路径「从图库选择」+ 次要「单张上传」
 * 适配 Form.Item value/onChange
 */
const MediaPicker: React.FC<MediaPickerProps> = ({
  value,
  onChange,
  shopId = DEFAULT_SHOP_ID,
  allowSingleUpload = true,
  selectedHint = '已选择菜品图片',
  emptyHint = '尚未选择图片，推荐从图库批量维护后挑选',
  libraryButtonText = '从图库选择',
}) => {
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handleSingleUpload: UploadProps['beforeUpload'] = async (file) => {
    const err = validateImageFile(file as File);
    if (err) {
      message.error(err);
      return Upload.LIST_IGNORE;
    }

    setUploading(true);
    try {
      const result = await uploadMenuImage(file as File, shopId);
      onChange?.(result.url);
      message.success('上传成功');
    } catch (error) {
      console.error('单张上传失败:', error);
      if (!isRequestErrorHandled(error)) {
        message.error('上传失败');
      }
    } finally {
      setUploading(false);
    }
    return false;
  };

  return (
    <div className="tf-media-picker">
      {value ? (
        <div className="tf-media-picker__preview">
          <Image
            src={value}
            width={96}
            height={96}
            className="tf-media-picker__preview-img"
            style={{ objectFit: 'cover', borderRadius: 8 }}
            fallback="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='96' height='96'%3E%3Crect width='100%25' height='100%25' fill='%23f5f5f5'/%3E%3C/svg%3E"
          />
          <Space direction="vertical" size={4}>
            <Button danger size="small" icon={<DeleteOutlined />} onClick={() => onChange?.('')}>
              移除
            </Button>
            <span className="tf-media-picker__hint">{selectedHint}</span>
          </Space>
        </div>
      ) : (
        <div className="tf-media-picker__hint">{emptyHint}</div>
      )}

      <div className="tf-media-picker__actions">
        <Button type="primary" icon={<PictureOutlined />} onClick={() => setOpen(true)}>
          {libraryButtonText}
        </Button>
        {allowSingleUpload ? (
          <Upload accept={ACCEPT} showUploadList={false} beforeUpload={handleSingleUpload} maxCount={1}>
            <Button icon={<UploadOutlined />} loading={uploading}>
              {value ? '单张重传' : '单张上传'}
            </Button>
          </Upload>
        ) : null}
      </div>

      <MediaPickerModal
        open={open}
        shopId={shopId}
        value={value}
        onCancel={() => setOpen(false)}
        onSelect={(url) => {
          onChange?.(url);
          setOpen(false);
          message.success('已选择图片');
        }}
      />
    </div>
  );
};

export default MediaPicker;
