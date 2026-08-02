import { useEffect, useState } from 'react';
import { View, Text, Input, Switch } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import { get, post, patch } from '../../utils/request';
import { isValidPhone, isNonEmpty } from '../../utils/validators';
import { DEFAULT_SHOP_ID } from '../../env';
import { useAsyncAction } from '../../hooks/useAsyncAction';
import type { AddressItem } from './index';
import FooterBar from '../../components/FooterBar';
import './edit.scss';

const TAGS = ['家', '公司', '学校'];

const AddressEditPage = () => {
  const router = useRouter();
  const id = router.params?.id || '';
  const isEdit = !!id;

  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [detail, setDetail] = useState('');
  const [latitude, setLatitude] = useState<number | undefined>(undefined);
  const [longitude, setLongitude] = useState<number | undefined>(undefined);
  const [tag, setTag] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [loading, setLoading] = useState(isEdit);
  const { pending: saving, run: runSave } = useAsyncAction();

  useEffect(() => {
    if (!isEdit) return;
    (async () => {
      setLoading(true);
      try {
        const res = await get<AddressItem[]>('/addresses', { shopId: DEFAULT_SHOP_ID }, { useCache: false });
        const found = (res.data || []).find((a) => a.id === id);
        if (!found) {
          Taro.showToast({ title: '地址不存在', icon: 'none' });
          setTimeout(() => Taro.navigateBack(), 1000);
          return;
        }
        setContactName(found.contactName || '');
        setContactPhone(found.contactPhone || '');
        setDetail(found.detail || '');
        setLatitude(found.latitude);
        setLongitude(found.longitude);
        setTag(found.tag || '');
        setIsDefault(!!found.isDefault);
      } catch (e) {
        console.error('加载地址失败', e);
        Taro.showToast({ title: '加载失败', icon: 'none' });
      } finally {
        setLoading(false);
      }
    })();
  }, [id, isEdit]);

  const handleChooseLocation = async () => {
    try {
      const loc = await Taro.chooseLocation({});
      const name = (loc.name || '').trim();
      const address = (loc.address || '').trim();
      const merged = [address, name].filter(Boolean).join(' ');
      if (merged) setDetail(merged);
      if (typeof loc.latitude === 'number' && typeof loc.longitude === 'number') {
        setLatitude(loc.latitude);
        setLongitude(loc.longitude);
      }
    } catch (e: any) {
      // 用户取消不提示；权限/未配置则提示
      const msg = String(e?.errMsg || e?.message || '');
      if (/cancel|取消/i.test(msg)) return;
      console.error('选择位置失败', e);
      Taro.showToast({
        title: '选点失败，请检查定位权限或地图配置',
        icon: 'none',
      });
    }
  };

  const handleSave = async () => {
    if (!isNonEmpty(contactName)) {
      Taro.showToast({ title: '请填写联系人', icon: 'none' });
      return;
    }
    if (!isValidPhone(contactPhone)) {
      Taro.showToast({ title: '请填写正确手机号', icon: 'none' });
      return;
    }
    if (!isNonEmpty(detail)) {
      Taro.showToast({ title: '请填写详细地址', icon: 'none' });
      return;
    }
    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      Taro.showToast({ title: '请先地图选点，坐标必填', icon: 'none' });
      return;
    }

    await runSave(async () => {
      const payload = {
        shopId: DEFAULT_SHOP_ID,
        contactName: contactName.trim(),
        contactPhone: contactPhone.trim(),
        detail: detail.trim(),
        latitude,
        longitude,
        tag: tag.trim() || undefined,
        isDefault,
      };
      if (isEdit) {
        await patch(`/addresses/${id}`, payload);
      } else {
        await post('/addresses', payload);
      }
      Taro.showToast({ title: isEdit ? '已更新' : '已添加', icon: 'success' });
      setTimeout(() => Taro.navigateBack(), 600);
    }).catch((e) => {
      console.error('保存地址失败', e);
    });
  };

  if (loading) {
    return (
      <View className='address-edit'>
        <Text className='address-edit__loading'>加载中...</Text>
      </View>
    );
  }

  return (
    <View className='address-edit'>
      <View className='address-edit__card'>
        <View className='form-item'>
          <Text className='form-item__label'>
            联系人
            <Text className='form-required'>*</Text>
          </Text>
          <Input
            className='form-item__input'
            placeholder='姓名'
            value={contactName}
            onInput={(e) => setContactName(e.detail.value)}
          />
        </View>
        <View className='form-item'>
          <Text className='form-item__label'>
            手机号
            <Text className='form-required'>*</Text>
          </Text>
          <Input
            className='form-item__input'
            type='number'
            maxlength={11}
            placeholder='11 位手机号'
            value={contactPhone}
            onInput={(e) => setContactPhone(e.detail.value)}
          />
        </View>
        <View className='form-item form-item--block'>
          <Text className='form-item__label'>
            详细地址
            <Text className='form-required'>*</Text>
          </Text>
          <Input
            className='form-item__input'
            placeholder='地图选点后可补充门牌/楼层'
            value={detail}
            onInput={(e) => {
              // 允许在地图选点后补充门牌/楼层等文案，保留已选坐标
              setDetail(e.detail.value);
            }}
          />
          <View className='address-edit__loc-row'>
            <Text className='address-edit__loc-btn' onClick={handleChooseLocation}>
              地图选点（必选）
            </Text>
            <Text
              className={`address-edit__loc-hint${
                typeof latitude === 'number' && typeof longitude === 'number'
                  ? ''
                  : ' address-edit__loc-hint--warn'
              }`}
            >
              {typeof latitude === 'number' && typeof longitude === 'number'
                ? `已定位 ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`
                : '坐标必填，请点击地图选点'}
            </Text>
          </View>
        </View>
        <View className='form-item form-item--block'>
          <Text className='form-item__label'>标签</Text>
          <View className='tag-list'>
            {TAGS.map((t) => (
              <Text
                key={t}
                className={`tag-item ${tag === t ? 'active' : ''}`}
                onClick={() => setTag(tag === t ? '' : t)}
              >
                {t}
              </Text>
            ))}
          </View>
        </View>
        <View className='form-item form-item--switch'>
          <Text className='form-item__label'>设为默认地址</Text>
          <Switch checked={isDefault} color='#FF6B35' onChange={(e) => setIsDefault(!!e.detail.value)} />
        </View>
      </View>

      <FooterBar
        actionOnly
        actionText={saving ? '保存中...' : '保存地址'}
        actionDisabled={saving}
        onAction={handleSave}
      />
    </View>
  );
};

export default AddressEditPage;
