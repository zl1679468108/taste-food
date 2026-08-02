import { useCallback, useEffect, useState } from 'react';
import { View, Text } from '@tarojs/components';
import Taro, { useDidShow, useRouter } from '@tarojs/taro';
import { get, del, patch, post, isDuplicateSubmitError } from '../../utils/request';
import { useKeyedAsyncAction } from '../../hooks/useAsyncAction';
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
  /** 腾讯地图 GCJ-02 */
  latitude?: number;
  longitude?: number;
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
  const { isPending: isRowPending, run: runRowAction } = useKeyedAsyncAction();

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
    if (typeof item.latitude !== 'number' || typeof item.longitude !== 'number') {
      Taro.showModal({
        title: '地址缺少坐标',
        content: '该地址未地图选点，无法用于外卖配送。请先完善坐标。',
        confirmText: '去完善',
        success: (res) => {
          if (res.confirm) {
            Taro.navigateTo({ url: `/pages/address/edit?id=${item.id}` });
          }
        },
      });
      return;
    }
    try {
      Taro.setStorageSync('tf_selected_address', item);
    } catch (e) {
      console.warn('缓存选中地址失败', e);
    }
    const channel = Taro.getCurrentInstance().page?.getOpenerEventChannel?.();
    channel?.emit?.('addressSelected', item);
    Taro.navigateBack();
  };

  const handleSetDefault = (item: AddressItem) => {
    if (item.isDefault) return;
    if (typeof item.latitude !== 'number' || typeof item.longitude !== 'number') {
      Taro.showModal({
        title: '无法设为默认',
        content: '该地址缺少地图坐标，请先完善后再设为默认。',
        confirmText: '去完善',
        success: (res) => {
          if (res.confirm) goEdit(item.id);
        },
      });
      return;
    }
    void runRowAction(`default:${item.id}`, async () => {
      try {
        await patch(`/addresses/${item.id}/default`);
        Taro.showToast({ title: '已设为默认', icon: 'success' });
        loadList();
      } catch (e) {
        if (isDuplicateSubmitError(e)) return;
        // 兼容 POST 别名
        try {
          await post(`/addresses/${item.id}/set-default`);
          Taro.showToast({ title: '已设为默认', icon: 'success' });
          loadList();
        } catch (err) {
          if (isDuplicateSubmitError(err)) return;
          console.error('设默认失败', err);
        }
      }
    });
  };

  const handleDelete = (item: AddressItem) => {
    const key = `delete:${item.id}`;
    if (isRowPending(key)) return;
    Taro.showModal({
      title: '删除地址',
      content: `确认删除「${item.detail}」？`,
      success: (res) => {
        if (!res.confirm) return;
        void runRowAction(key, async () => {
          try {
            await del(`/addresses/${item.id}`);
            Taro.showToast({ title: '已删除', icon: 'success' });
            loadList();
          } catch (e) {
            if (isDuplicateSubmitError(e)) return;
            console.error('删除地址失败', e);
          }
        });
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
        />
        <FooterBar
          actionOnly
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
        />
        <FooterBar actionOnly actionText='再试一次' onAction={loadList} />
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
        />
      ) : (
        <View className='address-page__list'>
          {list.map((item) => {
            const settingDefault = isRowPending(`default:${item.id}`);
            const deleting = isRowPending(`delete:${item.id}`);
            return (
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
                  {typeof item.latitude !== 'number' || typeof item.longitude !== 'number' ? (
                    <Text className='address-card__no-coord'>缺坐标</Text>
                  ) : null}
                </View>
                <Text className='address-card__detail'>{item.detail}</Text>
              </View>
              <View className='address-card__actions' onClick={(e) => e.stopPropagation()}>
                {typeof item.latitude !== 'number' || typeof item.longitude !== 'number' ? (
                  <Text
                    className='address-card__action address-card__action--primary'
                    onClick={() => goEdit(item.id)}
                  >
                    完善坐标
                  </Text>
                ) : null}
                {!item.isDefault && (
                  <Text
                    className={`address-card__action${settingDefault ? ' is-disabled' : ''}`}
                    onClick={() => handleSetDefault(item)}
                  >
                    {settingDefault ? '设置中...' : '设默认'}
                  </Text>
                )}
                <Text className='address-card__action' onClick={() => goEdit(item.id)}>
                  编辑
                </Text>
                <Text
                  className={`address-card__action danger${deleting ? ' is-disabled' : ''}`}
                  onClick={() => handleDelete(item)}
                >
                  {deleting ? '删除中...' : '删除'}
                </Text>
              </View>
            </View>
            );
          })}
          <ListEndTip show={list.length > 0} hasMore={false} variant='footer' />
        </View>
      )}

      <FooterBar actionOnly actionText='新增地址' onAction={() => goEdit()} />
    </View>
  );
};

export default AddressListPage;
