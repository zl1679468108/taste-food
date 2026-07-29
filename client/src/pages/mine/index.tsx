import { useMemo } from 'react';
import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { useAuthStore } from '../../stores/authStore';
import EmptyState from '../../components/EmptyState';
import Icon from '../../components/Icon';
import type { IconName } from '../../components/Icon';
import './index.scss';

type AppRole = 'customer' | 'admin' | 'merchant' | 'rider';

const BRAND_COLOR = '#FF6B35';
const MUTED_ICON_COLOR = '#C2C2C2';

interface MenuItem {
  key: string;
  label: string;
  desc?: string;
  icon: IconName;
  onClick: () => void;
}

function normalizeRole(role?: string): AppRole {
  if (role === 'admin' || role === 'merchant' || role === 'rider') return role;
  return 'customer';
}

export default function MinePage() {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const getRoleLabel = useAuthStore((s) => s.getRoleLabel);
  const switchRole = useAuthStore((s) => s.switchRole);
  // 直接读取 user.roles 原始数据，避免在 selector 里调用方法返回新数组导致无限重渲染
  const userRoles = useAuthStore((s) => s.user?.roles);
  const switchableRoles = useMemo(() => {
    const roles = userRoles || [];
    const activeRoles = roles.filter((r) => r.status === 'active' && r.role !== 'admin');
    if (!activeRoles.some((r) => r.role === 'customer')) {
      return [{ role: 'customer', shopId: null as string | null, status: 'active' }, ...activeRoles];
    }
    return activeRoles;
  }, [userRoles]);

  const role = normalizeRole(user?.role);
  const roleLabel = getRoleLabel(role);
  // 无昵称时不重复展示角色名，统一用「微信用户」
  const displayName = user?.nickName?.trim() || '微信用户';
  const heroHint =
    role === 'admin' || role === 'merchant'
      ? '管理店铺订单与菜品'
      : role === 'rider'
        ? '接单配送，准时送达'
        : '点好味道，吃得开心';

  const serviceMenus = useMemo<MenuItem[]>(() => {
    if (role === 'admin' || role === 'merchant') {
      return [
        {
          key: 'admin-home',
          label: '商家工作台',
          desc: '接单处理 · 今日数据',
          icon: 'shop',
          onClick: () => Taro.switchTab({ url: '/pages/admin/index' }),
        },
        {
          key: 'menu-manage',
          label: '菜品管理',
          desc: '分类 / 上下架',
          icon: 'food',
          onClick: () => Taro.navigateTo({ url: '/pages/admin/menu-manage' }),
        },
        {
          key: 'user-manage',
          label: '会员管理',
          desc: '查看会员信息',
          icon: 'list',
          onClick: () => Taro.navigateTo({ url: '/pages/admin/user-manage' }),
        },
        {
          key: 'reviews',
          label: '评价列表',
          desc: '查看顾客反馈',
          icon: 'star',
          onClick: () => Taro.navigateTo({ url: '/pages/admin/reviews' }),
        },
      ];
    }

    if (role === 'rider') {
      return [
        {
          key: 'rider-home',
          label: '骑手工作台',
          desc: '待抢单 / 我的配送',
          icon: 'order',
          onClick: () => Taro.switchTab({ url: '/pages/rider/index' }),
        },
      ];
    }

    return [
      {
        key: 'favorites',
        label: '我的收藏',
        icon: 'heart',
        onClick: () => Taro.navigateTo({ url: '/pages/favorites/index' }),
      },
      {
        key: 'my-reviews',
        label: '我的评价',
        icon: 'star',
        onClick: () => Taro.navigateTo({ url: '/pages/reviews/index' }),
      },
      {
        key: 'address',
        label: '收货地址',
        icon: 'location',
        onClick: () => Taro.navigateTo({ url: '/pages/address/index' }),
      },
    ];
  }, [role]);

  const useGrid = role === 'customer';

  const handleLogout = () => {
    Taro.showModal({
      title: '退出登录',
      content: '确定退出当前账号吗？',
      confirmText: '退出',
      confirmColor: BRAND_COLOR,
      success: (res) => {
        if (res.confirm) logout();
      },
    });
  };

  if (!isLoggedIn) {
    return (
      <View className='mine-page'>
        <View className='mine-guest'>
          <EmptyState
            icon='lock'
            title='请先登录'
            description='登录后就能管理账号与订单'
            actionText='去登录'
            onAction={() => Taro.navigateTo({ url: '/pages/auth/login' })}
          />
        </View>
      </View>
    );
  }

  return (
    <View className='mine-page'>
      <View className='mine-hero'>
        <View className='mine-hero__card'>
          <View className='mine-hero__avatar'>
            <Icon
              name={role === 'admin' || role === 'merchant' ? 'shop' : role === 'rider' ? 'order' : 'food'}
              size={32}
              color={BRAND_COLOR}
            />
          </View>
          <View className='mine-hero__meta'>
            <View className='mine-hero__name-row'>
              <Text className='mine-hero__name'>{displayName}</Text>
              <Text className='mine-hero__role'>{roleLabel}</Text>
            </View>
            <Text className='mine-hero__hint'>{heroHint}</Text>
          </View>
        </View>
      </View>

      <View className='mine-body'>
        <View className={`mine-panel${useGrid ? ' mine-panel--grid' : ''}`}>
          <View className='mine-panel__head'>
            <Text className='mine-panel__title'>常用功能</Text>
          </View>

          {useGrid ? (
            <View className='mine-grid'>
              {serviceMenus.map((item) => (
                <View key={item.key} className='mine-grid__item' onClick={item.onClick}>
                  <View className='mine-grid__icon'>
                    <Icon name={item.icon} size={22} color={BRAND_COLOR} />
                  </View>
                  <Text className='mine-grid__label'>{item.label}</Text>
                </View>
              ))}
            </View>
          ) : (
            <View className='mine-list'>
              {serviceMenus.map((item, index) => (
                <View
                  key={item.key}
                  className={`mine-list__item${index === serviceMenus.length - 1 ? ' mine-list__item--last' : ''}`}
                  onClick={item.onClick}
                >
                  <View className='mine-list__icon'>
                    <Icon name={item.icon} size={20} color={BRAND_COLOR} />
                  </View>
                  <View className='mine-list__body'>
                    <Text className='mine-list__label'>{item.label}</Text>
                    {!!item.desc && <Text className='mine-list__desc'>{item.desc}</Text>}
                  </View>
                  <Icon name='arrow-right' size={16} color={MUTED_ICON_COLOR} />
                </View>
              ))}
            </View>
          )}
        </View>

        <View className='mine-panel mine-account-panel'>
          <View className='mine-panel__head'>
            <Text className='mine-panel__title'>账号服务</Text>
          </View>
          <View className='mine-list'>
            <View className='mine-list__item' onClick={() => Taro.navigateTo({ url: '/pages/mine/role-apply' })}>
              <View className='mine-list__icon'><Icon name='shop' size={20} color={BRAND_COLOR} /></View>
              <View className='mine-list__body'>
                <Text className='mine-list__label'>身份申请</Text>
                <Text className='mine-list__desc'>申请成为商家 / 骑手</Text>
              </View>
              <Icon name='arrow-right' size={16} color={MUTED_ICON_COLOR} />
            </View>
            <View className='mine-list__item mine-list__item--last' onClick={() => Taro.navigateTo({ url: '/pages/mine/notifications' })}>
              <View className='mine-list__icon'><Icon name='list' size={20} color={BRAND_COLOR} /></View>
              <View className='mine-list__body'>
                <Text className='mine-list__label'>消息中心</Text>
                <Text className='mine-list__desc'>审批结果与系统通知</Text>
              </View>
              <Icon name='arrow-right' size={16} color={MUTED_ICON_COLOR} />
            </View>
          </View>
        </View>

        {switchableRoles.length > 1 && (
          <View className='mine-panel mine-account-panel'>
            <View className='mine-panel__head'>
              <Text className='mine-panel__title'>切换身份</Text>
            </View>
            <View className='mine-role-switch'>
              {switchableRoles.map((r) => (
                <View
                  key={`${r.role}-${r.shopId || ''}`}
                  className={`mine-role-switch__item${r.role === role ? ' is-active' : ''}`}
                  onClick={() => {
                    if (r.role === role) return;
                    switchRole(r.role as any, r.shopId || undefined);
                  }}
                >
                  <Text className='mine-role-switch__label'>{getRoleLabel(r.role)}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View className='mine-logout' onClick={handleLogout}>
          <Text className='mine-logout__text'>退出登录</Text>
        </View>
      </View>
    </View>
  );
}
