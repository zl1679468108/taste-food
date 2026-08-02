import { useEffect, useMemo, useState } from 'react';
import { View } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { useAuthStore } from '../stores/authStore';
import Icon from '../components/Icon';
import type { IconName } from '../components/Icon';
import {
  getCurrentTabPath,
  getTabBarSelectedPath,
  setTabBarSelectedPath,
  subscribeTabBarSelectedPath,
} from '../utils/tab-bar';
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
  const [selectedPath, setSelectedPath] = useState(() => getTabBarSelectedPath());

  // 订阅外部同步（页面 onShow / 角色跳转），并在角色切换后按当前页校正
  useEffect(() => {
    const syncFromCurrentPage = () => {
      const current = getCurrentTabPath() || getTabBarSelectedPath();
      if (current) {
        setTabBarSelectedPath(current);
        setSelectedPath(current);
      }
    };

    syncFromCurrentPage();
    return subscribeTabBarSelectedPath((path) => {
      setSelectedPath(path);
    });
  }, [role]);

  const handleTap = (item: TabItem) => {
    if (selectedPath === item.pagePath) return;
    // 先更新激活态，避免 switchTab 后自定义 tabBar 不重渲染导致高亮滞后
    setTabBarSelectedPath(item.pagePath);
    Taro.switchTab({ url: item.pagePath });
  };

  return (
    <View className='custom-tab-bar'>
      <View className='custom-tab-bar__inner'>
        {tabs.map((item) => {
          const active = selectedPath === item.pagePath;
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
