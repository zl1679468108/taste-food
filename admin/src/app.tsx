import React, { useEffect } from 'react';
import type { RunTimeLayoutConfig } from '@umijs/max';
import { history } from '@umijs/max';
import { App, Dropdown, message as antdStaticMessage, Space } from 'antd';
import { antdMessage as message, setAntdMessage } from '@/utils/antdApp';
import { LogoutOutlined } from '@ant-design/icons';
import { getCurrentUser, homePathForRole } from './services/auth';
import ShopSelector from './components/ShopSelector';
import NotificationBell from './components/NotificationBell';
import RoleSwitcher from './components/RoleSwitcher';
import { brand } from './theme';
import brandLogo from './assets/images/brand-logo.png';
import { computeAccess, EMPTY_ACCESS } from '@/utils/computeAccess';
import { ensureTokenRefreshLoop, stopTokenRefreshLoop } from '@/utils/request';

const loginPath = '/login';

function clearBrokenAuth() {
  localStorage.removeItem('token');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('user');
}

export async function getInitialState(): Promise<{
  currentUser?: API.CurrentUser;
  admin?: {
    canAdmin: boolean;
    canPlatformAdmin?: boolean;
    canOps?: boolean;
    canPlatform?: boolean;
    canMerchant?: boolean;
  };
}> {
  const token = localStorage.getItem('token');
  const userStr = localStorage.getItem('user');
  const pathname = window.location.pathname;

  // 未登录且不在登录页，跳转到登录页（用 location.href 避免 UMI 渲染阶段 history.push 的竞态）
  if (!token) {
    if (pathname !== '/login') {
      window.location.href = loginPath;
      return { currentUser: undefined, admin: EMPTY_ACCESS };
    }
    return { currentUser: undefined, admin: EMPTY_ACCESS };
  }

  // 已登录：确保主动刷新循环运行（页面刷新后兜底启动，避免 token 静默过期）
  ensureTokenRefreshLoop();

  // token 存在但 user 数据损坏：清掉无效登录态
  let parsedUser: API.CurrentUser | null = null;
  if (userStr) {
    try {
      parsedUser = JSON.parse(userStr) as API.CurrentUser;
    } catch {
      clearBrokenAuth();
      if (pathname !== '/login') {
        window.location.href = loginPath;
        return { currentUser: undefined, admin: EMPTY_ACCESS };
      }
      return { currentUser: undefined, admin: EMPTY_ACCESS };
    }
  }

  // 已登录但在登录页，按角色分流到对应端首页
  if (pathname === '/login') {
    history.push(homePathForRole(parsedUser?.role, parsedUser?.shopId));
  }

  // 优先用 localStorage 缓存的用户信息恢复 UI（避免 token 失效时空白）
  // token 真正有效性由 request 拦截器在 401 时清除登录态
  const raw = parsedUser || await getCurrentUser();
  const currentUser = raw
    ? ({
        id: (raw as any).id || (raw as any).userId,
        name: (raw as any).name || (raw as any).nickName || '管理员',
        role: (raw as any).role,
        shopId: (raw as any).shopId || undefined,
      } as API.CurrentUser)
    : undefined;
  return {
    currentUser,
    admin: computeAccess(currentUser),
  };
}

export const layout: RunTimeLayoutConfig = ({ initialState, setInitialState }) => {
  return {
    logo: (
      <img
        src={brandLogo}
        alt="小买卖"
        style={{ width: 28, height: 28, borderRadius: 6, display: 'block' }}
      />
    ),
    title: initialState?.admin?.canPlatformAdmin ? '小买卖 · 平台运营' : '小买卖 · 商家后台',
    avatarProps: {
      title: initialState?.currentUser?.name || '管理员',
      size: 'small',
      render: (_, defaultDom) => {
        return (
          <Dropdown
            menu={{
              items: [
                {
                  key: 'user',
                  label: initialState?.currentUser?.name || '管理员',
                  disabled: true,
                },
                {
                  type: 'divider',
                },
                {
                  key: 'logout',
                  icon: <LogoutOutlined />,
                  label: '退出登录',
                  onClick: () => {
                    localStorage.removeItem('token');
                    localStorage.removeItem('refreshToken');
                    localStorage.removeItem('user');
                    // 停止主动刷新循环，避免登出后仍在刷新
                    stopTokenRefreshLoop();
                    // 保留 tf_admin_shop_id：下次登录可恢复上次选择的店
                    setInitialState({ currentUser: null, admin: EMPTY_ACCESS });
                    message.success('已退出登录');
                    history.push(loginPath);
                  },
                },
              ],
            }}
            trigger={['click']}
          >
            <Space style={{ cursor: 'pointer' }}>
              {defaultDom}
            </Space>
          </Dropdown>
        );
      },
    },
    // 顶栏右侧：店铺选择器（业务页按当前店过滤）
    actionsRender: () => {
      if (!initialState?.currentUser) return [];
      const isPlatform = !!initialState?.admin?.canPlatformAdmin;
      return [
        // 平台/商家角色由 RoleSwitcher 展示，不再额外显示标签
        ...(isPlatform ? [] : [<RoleSwitcher key="role-switcher" compact />]),
        <NotificationBell key="notification-bell" />,
        <ShopSelector key="shop-selector" />,
      ];
    },
    onPageNotFound: () => { history.push('/'); },
    // 侧边栏底部附加版本信息
    menuFooterRender: () => (
 <div
 style={{
 textAlign: 'center',
 padding: 'var(--tf-space-3) 0',
 color: brand.textTertiary,
 fontSize: 12,
 borderTop: `1px solid ${brand.border}`,
 }}
 >
 版本 2026.7.30
 </div>
 ),
 menuHeaderRender: undefined,
    waterMarkProps: undefined,
    fixSiderbar: true,
    fixedHeader: true,
    contentWidth: 'Fluid',
    layout: 'mix',
    splitMenus: false,
    navTheme: 'light',
    colorWeak: false,
    contentStyle: { margin: 0, padding: 0 },
    // 全局去掉面包屑，页面只保留标题+刷新组件
    breadcrumbRender: false,
    pageTitleRender: false,
  };
};

import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';

function RootApp({ container }: { container: React.ReactNode }) {
  // 根 message holder：把实例写入 antdApp 单例，供业务模块（request 拦截器、回调等）
  // 在非组件上下文也能消费 App 上下文（消除 antd v5 静态 message 告警）。
  const [messageApi, messageHolder] = antdStaticMessage.useMessage();
  useEffect(() => {
    setAntdMessage(messageApi);
  }, [messageApi]);
  return (
    <QueryClientProvider client={queryClient}>
      <App>
        {messageHolder}
        {container}
      </App>
    </QueryClientProvider>
  );
}

export function rootContainer(container: React.ReactNode) {
  return <RootApp container={container} />;
}
