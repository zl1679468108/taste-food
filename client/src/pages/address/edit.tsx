import { useEffect, useState } from 'react';
import { View, Text, Input, Switch } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import { get, post, patch } from '../../utils/request';
import { isValidPhone, isNonEmpty } from '../../utils/validators';
import { DEFAULT_SHOP_ID } from '../../env';
import { useAsyncAction } from '../../hooks/useAsyncAction';
import type { AddressItem } from './index';
import './edit.scss';

const TAGS = ['家', '公司', '学校'];

const AddressEditPage = () => {
  const router = useRouter();
  const id = router.params?.id || '';
  const isEdit = !!id;

  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [detail, setDetail] = useState('');
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

    await runSave(async () => {
      const payload = {
        shopId: DEFAULT_SHOP_ID,
        contactName: contactName.trim(),
        contactPhone: contactPhone.trim(),
        detail: detail.trim(),
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
          <Text className='form-item__label'>联系人</Text>
          <Input
            className='form-item__input'
            placeholder='姓名'
            value={contactName}
            onInput={(e) => setContactName(e.detail.value)}
          />
        </View>
        <View className='form-item'>
          <Text className='form-item__label'>手机号</Text>
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
          <Text className='form-item__label'>详细地址</Text>
          <Input
            className='form-item__input'
            placeholder='小区 / 门牌号等'
            value={detail}
            onInput={(e) => setDetail(e.detail.value)}
          />
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

      <View
        className={`address-edit__save ${saving ? 'disabled' : ''}`}
        onClick={() => {
          if (!saving) handleSave();
        }}
      >
        <Text>{saving ? '保存中...' : '保存地址'}</Text>
      </View>
    </View>
  );
};

export default AddressEditPage;
