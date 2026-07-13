import type { RunTimeLayoutConfig } from '@umijs/max';
import { history } from '@umijs/max';
import { message, Dropdown, Space } from 'antd';
import { LogoutOutlined } from '@ant-design/icons';
import { getCurrentUser } from './services/auth';

const loginPath = '/login';

export async function getInitialState(): Promise<{
  currentUser?: API.CurrentUser;
  admin?: { canAdmin: boolean };
}> {
  const token = localStorage.getItem('token');
  const pathname = window.location.pathname;

  // 未登录且不在登录页，跳转到登录页
  if (!token && pathname !== '/login') {
    history.push(loginPath);
    return { currentUser: undefined, admin: { canAdmin: false } };
  }

  // 已登录但在登录页，跳转到首页
  if (token && pathname === '/login') {
    history.push('/dashboard');
  }

  const currentUser = await getCurrentUser();
  // 权限根据用户角色决定，未登录或角色非 admin 时禁止访问
  const canAdmin = !!currentUser && currentUser.role === 'admin';
  return { currentUser, admin: { canAdmin } };
}

export const layout: RunTimeLayoutConfig = ({ initialState, setInitialState }) => {
  return {
    logo: (
      <div style={{ 
        fontSize: 28, 
        lineHeight: '28px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        🍜
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
      <div style={{ textAlign: 'center', padding: '16px 0', color: '#999' }}>
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
    primaryColor: '#1890ff',
    colorWeak: false,
    contentStyle: { margin: 0 },
  };
};
