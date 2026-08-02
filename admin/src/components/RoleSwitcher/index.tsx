import React, { useState } from 'react';
import { Button, Select, Space, Typography } from 'antd';
import { antdMessage as message } from '@/utils/antdApp';
import { SwapOutlined } from '@ant-design/icons';
import { useModel } from '@umijs/max';
import {
  switchRole,
  persistAuthSession,
  toCurrentUser,
  homePathForRole,
  type UserRoleItem,
} from '@/services/auth';
import { computeAccess } from '@/utils/computeAccess';

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

function buildRoleOptions(user?: API.CurrentUser): UserRoleItem[] {
  const options = [...((user?.roles || []) as UserRoleItem[])];
  const addOption = (role?: string, shopId?: string | null) => {
    if (!role) return;
    const key = roleKey({ role, shopId, status: 'active' });
    if (!options.some((item) => roleKey(item) === key)) {
      options.push({ role, shopId: shopId || null, status: 'active' });
    }
  };

  addOption(user?.role, user?.shopId);
  addOption('customer', null);
  return options;
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
  const roles = buildRoleOptions(user);
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
        admin: computeAccess(result),
      }));
      setValue(nextKey);
      message.success(`已切换为${roleLabel[result.role] || result.role}`);
      // 角色变化会同时改变菜单权限和店铺上下文，整页导航确保两者从新会话一致初始化。
      window.location.href = homePathForRole(result.role, result.shopId);
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
    <Space direction="vertical" size={12} style={{ width: "100%" }}>
      <Select
        style={{ width: "100%" }}
        loading={loading}
        value={value}
        options={roles.map((r) => ({
          value: roleKey(r),
          label: roleOptionLabel(r),
        }))}
        onChange={setValue}
      />
      <Button type="primary" loading={loading} icon={<SwapOutlined />} onClick={() => void applyRole(value)} style={{ width: "100%" }}>
        切换角色
      </Button>
    </Space>
  );
};

export default RoleSwitcher;
