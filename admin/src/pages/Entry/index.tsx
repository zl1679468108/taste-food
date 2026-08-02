import React, { useEffect } from 'react';
import { useModel } from '@umijs/max';
import { homePathForRole } from '@/services/auth';

/**
 * 根入口重定向（T300.2）。
 * 直接访问 '/' 时由 UMI 渲染此页（layout:false），再根据当前角色分流到对应端首页。
 */
const Entry: React.FC = () => {
  const { initialState } = useModel('@@initialState');
  useEffect(() => {
    const user = initialState?.currentUser;
    if (!user?.role) {
      window.location.href = '/login';
      return;
    }
    window.location.href = homePathForRole(user.role, user.shopId);
  }, [initialState]);
  return null;
};

export default Entry;
