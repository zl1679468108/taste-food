import React, { useState } from 'react';
import { Button, Select, Space, message, Typography } from 'antd';
import { SwapOutlined } from '@ant-design/icons';
import { useModel, history } from '@umijs/max';
import {
  switchRole,
  persistAuthSession,
  toCurrentUser,
  homePathForRole,
  type UserRoleItem,
} from '@/services/auth';

const { Text } = Typography;

const roleLabel: Record<string, string> = {
  admin: '平台管理员',
  merchant: '商家',
  rider: '骑手',
  customer: '顾客',
};

function roleOptionLabel(r: UserRoleItem): string {
  const base = roleLabel[r.role] || r.role;
  if (r.role === 'merchant' && r.shopId) {
    return `${base}（${String(r.shopId).slice(0, 8)}…）`;
  }
  return base;
}

function roleKey(r: UserRoleItem): string {
  return `${r.role}::${r.shopId || ''}`;
}

export interface RoleSwitcherProps {
  /** 紧凑模式：顶栏下拉 */
  compact?: boolean;
}

/**
 * 多角色切换：调用 POST /api/auth/switch-role，刷新会话并按角色跳转首页。
 */
const RoleSwitcher: React.FC<RoleSwitcherProps> = ({ compact = false }) => {
  const { initialState, setInitialState } = useModel('@@initialState');
  const user = initialState?.currentUser;
  const roles = (user?.roles || []) as UserRoleItem[];
  const [value, setValue] = useState<string>(() =>
    roleKey({ role: user?.role || 'customer', shopId: user?.shopId, status: 'active' }),
  );
  const [loading, setLoading] = useState(false);

  if (!user || roles.length <= 1) {
    if (compact) return null;
    return <Text type="secondary">仅一个可用角色</Text>;
  }

  const applyRole = async (nextKey: string) => {
    const [role, shopId = ''] = nextKey.split('::');
    if (!role) return;
    if (role === user.role && (shopId || undefined) === (user.shopId || undefined)) {
      return;
    }
    setLoading(true);
    try {
      const result = await switchRole({
        role,
        shopId: shopId || undefined,
      });
      persistAuthSession(result);
      const currentUser = toCurrentUser(result);
      await setInitialState((prev: any) => ({
        ...prev,
        currentUser,
        admin: {
          canOps: result.role === 'admin' || result.role === 'merchant',
          canPlatform: result.role === 'admin' && !result.shopId,
          canMerchant: result.role === 'merchant',
          canAdmin: result.role === 'admin' || result.role === 'merchant',
          canPlatformAdmin: result.role === 'admin' && !result.shopId,
        },
      }));
      setValue(nextKey);
      message.success(`已切换为${roleLabel[result.role] || result.role}`);
      history.push(homePathForRole(result.role));
      // 强制刷新布局菜单
      setTimeout(() => {
        window.location.reload();
      }, 200);
    } catch {
      // interceptor
    } finally {
      setLoading(false);
    }
  };

  if (compact) {
    return (
      <Select
        size="small"
        loading={loading}
        value={value}
        style={{ minWidth: 140 }}
        options={roles.map((r) => ({
          value: roleKey(r),
          label: roleOptionLabel(r),
        }))}
        onChange={(v) => void applyRole(v)}
        suffixIcon={<SwapOutlined />}
      />
    );
  }

  return (
    <Space wrap>
      <Select
        style={{ minWidth: 220 }}
        loading={loading}
        value={value}
        options={roles.map((r) => ({
          value: roleKey(r),
          label: roleOptionLabel(r),
        }))}
        onChange={setValue}
      />
      <Button type="primary" loading={loading} icon={<SwapOutlined />} onClick={() => void applyRole(value)}>
        切换角色
      </Button>
    </Space>
  );
};

export default RoleSwitcher;
