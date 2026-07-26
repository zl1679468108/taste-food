import type { RunTimeLayoutConfig } from '@umijs/max';
import { history } from '@umijs/max';
import { message, Dropdown, Space } from 'antd';
import { LogoutOutlined, CoffeeOutlined } from '@ant-design/icons';
import { getCurrentUser } from './services/auth';
import { brand } from './theme';

const loginPath = '/login';

function clearBrokenAuth() {
  localStorage.removeItem('token');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('user');
}

export async function getInitialState(): Promise<{
  currentUser?: API.CurrentUser;
  admin?: { canAdmin: boolean };
}> {
  const token = localStorage.getItem('token');
  const userStr = localStorage.getItem('user');
  const pathname = window.location.pathname;

  // 未登录且不在登录页，跳转到登录页（用 location.href 避免 UMI 渲染阶段 history.push 的竞态）
  if (!token) {
    if (pathname !== '/login') {
      window.location.href = loginPath;
      return { currentUser: undefined, admin: { canAdmin: false } };
    }
    return { currentUser: undefined, admin: { canAdmin: false } };
  }

  // token 存在但 user 数据损坏：清掉无效登录态
  let parsedUser: API.CurrentUser | null = null;
  if (userStr) {
    try {
      parsedUser = JSON.parse(userStr) as API.CurrentUser;
    } catch {
      clearBrokenAuth();
      if (pathname !== '/login') {
        window.location.href = loginPath;
        return { currentUser: undefined, admin: { canAdmin: false } };
      }
      return { currentUser: undefined, admin: { canAdmin: false } };
    }
  }

  // 已登录但在登录页，跳转到首页
  if (pathname === '/login') {
    history.push('/dashboard');
  }

  // 优先用 localStorage 缓存的用户信息恢复 UI（避免 token 失效时空白）
  // token 真正有效性由 request 拦截器在 401 时清除登录态
  const currentUser = parsedUser || await getCurrentUser();
  const canAdmin = !!currentUser && currentUser.role === 'admin';
  return { currentUser: currentUser || undefined, admin: { canAdmin } };
}

export const layout: RunTimeLayoutConfig = ({ initialState, setInitialState }) => {
  return {
    logo: (
      <div style={{
        width: 28,
        height: 28,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: brand.primary,
        fontSize: 22,
      }}>
        <CoffeeOutlined />
      </div>
    ),
    title: '小买卖管理后台',
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
                    setInitialState({ currentUser: null, admin: { canAdmin: false } });
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
    onPageNotFound: () => { history.push('/'); },
    footerRender: () => (
      <div style={{ textAlign: 'center', padding: '16px 0', color: brand.textTertiary }}>
        小买卖点餐系统 ©2026
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
    contentStyle: { margin: 0, padding: '0 0 24px' },
    // 全局去掉面包屑，页面只保留标题+刷新组件
    breadcrumbRender: false,
    pageTitleRender: false,
  };
};

