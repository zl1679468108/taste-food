import { useCallback, useMemo, useState } from 'react';
import { View, Text } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import { useAuthStore } from '../../stores/authStore';
import EmptyState from '../../components/EmptyState';
import Icon from '../../components/Icon';
import type { IconName } from '../../components/Icon';
import FooterBar from '../../components/FooterBar';
import { useAsyncAction, useSyncTabBar } from '../../hooks';
import { get } from '../../utils/request';
import { TAB_BAR_PATHS } from '../../utils/tab-bar';
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

function formatUnreadCount(count: number): string {
  if (count <= 0) return '';
  if (count > 99) return '99+';
  return String(count);
}

export default function MinePage() {
  useSyncTabBar(TAB_BAR_PATHS.mine);
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const fetchMe = useAuthStore((s) => s.fetchMe);
  const getRoleLabel = useAuthStore((s) => s.getRoleLabel);
  const switchRole = useAuthStore((s) => s.switchRole);
  const { pending: switching, run: runSwitchRole } = useAsyncAction();
  const [switchingKey, setSwitchingKey] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
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
  const unreadText = formatUnreadCount(unreadCount);
  const hasExtraRoles = switchableRoles.some((r) => r.role !== 'customer' && r.role !== role);

  const loadUnreadCount = useCallback(async () => {
    if (!useAuthStore.getState().isLoggedIn) {
      setUnreadCount(0);
      return;
    }
    try {
      const res = await get<{ count: number }>('/notifications/unread-count', undefined, { showError: false });
      setUnreadCount(Math.max(0, Number(res.data?.count || 0)));
    } catch {
      // 未读数失败不影响主流程
    }
  }, []);

  const refreshMine = useCallback(async () => {
    if (!useAuthStore.getState().isLoggedIn) {
      setUnreadCount(0);
      return;
    }
    // 审批通过后本地 user.roles 可能仍是旧缓存，每次进入「我的」都拉最新身份
    await Promise.all([fetchMe(), loadUnreadCount()]);
  }, [fetchMe, loadUnreadCount]);

  useDidShow(() => {
    void refreshMine();
  });

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

    if (role === 'rider') return [];

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
          />
        </View>
        <FooterBar
          actionOnly
          avoidTabBar
          actionText='去登录'
          onAction={() => Taro.navigateTo({ url: '/pages/auth/login' })}
        />
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
        {serviceMenus.length > 0 && (
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
        )}

        {switchableRoles.length > 1 && (
          <View className='mine-panel mine-account-panel'>
            <View className='mine-panel__head'>
              <Text className='mine-panel__title'>切换身份</Text>
              {hasExtraRoles ? (
                <Text className='mine-panel__hint'>审批已通过，点下方身份即可接单</Text>
              ) : null}
            </View>
            <View className='mine-role-switch'>
              {switchableRoles.map((r) => {
                const itemKey = `${r.role}-${r.shopId || ''}`;
                const isSwitchingItem = switchingKey === itemKey;
                return (
                  <View
                    key={itemKey}
                    className={`mine-role-switch__item${r.role === role ? ' is-active' : ''}${switching ? ' is-disabled' : ''}`}
                    onClick={() => {
                      if (r.role === role || switching) return;
                      setSwitchingKey(itemKey);
                      runSwitchRole(async () => {
                        try {
                          await switchRole(r.role as any, r.shopId || undefined);
                        } catch {
                          // switchRole 内部已提示错误
                        } finally {
                          setSwitchingKey(null);
                        }
                      });
                    }}
                  >
                    <Text className='mine-role-switch__label'>
                      {isSwitchingItem ? '切换中...' : getRoleLabel(r.role)}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

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
              {unreadText ? (
                <View className='mine-list__badge'>
                  <Text className='mine-list__badge-text'>{unreadText}</Text>
                </View>
              ) : (
                <Icon name='arrow-right' size={16} color={MUTED_ICON_COLOR} />
              )}
            </View>
          </View>
        </View>

        <View className='mine-logout' onClick={handleLogout}>
          <Text className='mine-logout__text'>退出登录</Text>
        </View>
      </View>
    </View>
  );
}
