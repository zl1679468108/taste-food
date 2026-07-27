import { useCallback, useEffect, useState } from 'react';
import { View, Text } from '@tarojs/components';
import Taro, { useDidShow, useRouter } from '@tarojs/taro';
import { get, del, patch, post } from '../../utils/request';
import { useAuthStore } from '../../stores/authStore';
import EmptyState from '../../components/EmptyState';
import SkeletonLoader from '../../components/SkeletonLoader';
import { DEFAULT_SHOP_ID } from '../../env';
import FooterBar from '../../components/FooterBar';
import './index.scss';
import ListEndTip from '../../components/ListEndTip';

export interface AddressItem {
  id: string;
  userId: string;
  shopId?: string;
  contactName: string;
  contactPhone: string;
  detail: string;
  tag?: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

const AddressListPage = () => {
  const router = useRouter();
  const selectMode = router.params?.select === '1';
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const [loading, setLoading] = useState(true);
  const [list, setList] = useState<AddressItem[]>([]);
  const [loadError, setLoadError] = useState(false);

  const loadList = useCallback(async () => {
    if (!useAuthStore.getState().isLoggedIn) {
      setList([]);
      setLoading(false);
      setLoadError(false);
      return;
    }
    setLoading(true);
    setLoadError(false);
    try {
      const res = await get<AddressItem[]>('/addresses', { shopId: DEFAULT_SHOP_ID }, { useCache: false });
      setList(res.data || []);
    } catch (e) {
      console.error('加载地址失败:', e);
      setLoadError(true);
      setList([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadList();
  }, [loadList, isLoggedIn]);

  useDidShow(() => {
    loadList();
  });

  Taro.usePullDownRefresh(() => {
    loadList().finally(() => Taro.stopPullDownRefresh());
  });

  const goEdit = (id?: string) => {
    const url = id ? `/pages/address/edit?id=${id}` : '/pages/address/edit';
    Taro.navigateTo({ url });
  };

  const handleSelect = (item: AddressItem) => {
    if (!selectMode) return;
    try {
      Taro.setStorageSync('tf_selected_address', item);
    } catch (e) {
      console.warn('缓存选中地址失败', e);
    }
    const channel = Taro.getCurrentInstance().page?.getOpenerEventChannel?.();
    channel?.emit?.('addressSelected', item);
    Taro.navigateBack();
  };

  const handleSetDefault = async (item: AddressItem) => {
    if (item.isDefault) return;
    try {
      await patch(`/addresses/${item.id}/default`);
      Taro.showToast({ title: '已设为默认', icon: 'success' });
      loadList();
    } catch (e) {
      // 兼容 POST 别名
      try {
        await post(`/addresses/${item.id}/set-default`);
        Taro.showToast({ title: '已设为默认', icon: 'success' });
        loadList();
      } catch (err) {
        console.error('设默认失败', err);
      }
    }
  };

  const handleDelete = (item: AddressItem) => {
    Taro.showModal({
      title: '删除地址',
      content: `确认删除「${item.detail}」？`,
      success: async (res) => {
        if (!res.confirm) return;
        try {
          await del(`/addresses/${item.id}`);
          Taro.showToast({ title: '已删除', icon: 'success' });
          loadList();
        } catch (e) {
          console.error('删除地址失败', e);
        }
      },
    });
  };

  if (loading) {
    return (
      <View className='address-page'>
        <SkeletonLoader mode='address' count={3} />
      </View>
    );
  }

  if (!isLoggedIn) {
    return (
      <View className='address-page'>
        <EmptyState
          icon='lock'
          title='请先登录'
          description='登录后就能管理收货地址'
          actionText='去登录'
          onAction={() => Taro.navigateTo({ url: '/pages/auth/login' })}
        />
      </View>
    );
  }

  if (loadError) {
    return (
      <View className='address-page'>
        <EmptyState
          icon='warning'
          title='加载失败'
          description='地址暂时加载不出来'
          actionText='再试一次'
          onAction={loadList}
        />
      </View>
    );
  }

  return (
    <View className='address-page'>
      {list.length === 0 ? (
        <EmptyState
          icon='location'
          title='还没有地址'
          description='添加后外卖下单会更快捷'
          actionText='新增地址'
          onAction={() => goEdit()}
        />
      ) : (
        <View className='address-page__list'>
          {list.map((item) => (
            <View
              key={item.id}
              className={`address-card ${item.isDefault ? 'is-default' : ''}`}
              onClick={() => (selectMode ? handleSelect(item) : undefined)}
            >
              <View className='address-card__main'>
                <View className='address-card__row'>
                  <Text className='address-card__name'>{item.contactName}</Text>
                  <Text className='address-card__phone'>{item.contactPhone}</Text>
                  {item.tag ? <Text className='address-card__tag'>{item.tag}</Text> : null}
                  {item.isDefault ? <Text className='address-card__default'>默认</Text> : null}
                </View>
                <Text className='address-card__detail'>{item.detail}</Text>
              </View>
              <View className='address-card__actions' onClick={(e) => e.stopPropagation()}>
                {!item.isDefault && (
                  <Text className='address-card__action' onClick={() => handleSetDefault(item)}>
                    设默认
                  </Text>
                )}
                <Text className='address-card__action' onClick={() => goEdit(item.id)}>
                  编辑
                </Text>
                <Text className='address-card__action danger' onClick={() => handleDelete(item)}>
                  删除
                </Text>
              </View>
            </View>
          ))}
          <ListEndTip show={list.length > 0} hasMore={false} variant='footer' />
        </View>
      )}

      <FooterBar actionOnly actionText='新增地址' onAction={() => goEdit()} />
    </View>
  );
};

export default AddressListPage;
