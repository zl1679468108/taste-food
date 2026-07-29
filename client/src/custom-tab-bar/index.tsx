import { useMemo } from 'react';
import { View } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { useAuthStore } from '../stores/authStore';
import Icon from '../components/Icon';
import type { IconName } from '../components/Icon';
import './index.scss';

interface TabItem {
  pagePath: string;
  text: string;
  icon: IconName;
}

const CUSTOMER_TABS: TabItem[] = [
  { pagePath: '/pages/menu/index', text: '菜单', icon: 'menu' },
  { pagePath: '/pages/order-list/index', text: '订单', icon: 'order' },
  { pagePath: '/pages/mine/index', text: '我的', icon: 'user' },
];

const MERCHANT_TABS: TabItem[] = [
  { pagePath: '/pages/admin/index', text: '工作台', icon: 'shop' },
  { pagePath: '/pages/mine/index', text: '我的', icon: 'user' },
];

const RIDER_TABS: TabItem[] = [
  { pagePath: '/pages/rider/index', text: '接单', icon: 'order' },
  { pagePath: '/pages/mine/index', text: '我的', icon: 'user' },
];

const SELECTED_COLOR = '#FF6B35';
const NORMAL_COLOR = '#999999';

function tabsForRole(role?: string): TabItem[] {
  if (role === 'merchant' || role === 'admin') return MERCHANT_TABS;
  if (role === 'rider') return RIDER_TABS;
  return CUSTOMER_TABS;
}

export default function CustomTabBar() {
  const role = useAuthStore((s) => s.user?.role);
  const tabs = useMemo(() => tabsForRole(role), [role]);

  // 当前页面路径（每个 tab 页拥有独立的 tabBar 实例）
  const currentPath = Taro.getCurrentInstance().router?.path
    ? `/${Taro.getCurrentInstance().router!.path!.replace(/^\//, '').split('?')[0]}`
    : '';

  const handleTap = (item: TabItem) => {
    if (currentPath === item.pagePath) return;
    Taro.switchTab({ url: item.pagePath });
  };

  return (
    <View className='custom-tab-bar'>
      <View className='custom-tab-bar__inner'>
        {tabs.map((item) => {
          const active = currentPath === item.pagePath;
          return (
            <View
              key={item.pagePath}
              className={`custom-tab-bar__item${active ? ' is-active' : ''}`}
              onClick={() => handleTap(item)}
            >
              <View className='custom-tab-bar__icon'>
                <Icon name={item.icon} size={24} color={active ? SELECTED_COLOR : NORMAL_COLOR} />
              </View>
              <View
                className='custom-tab-bar__label'
                style={{ color: active ? SELECTED_COLOR : NORMAL_COLOR }}
              >
                {item.text}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}
