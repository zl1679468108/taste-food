import type { ReactNode } from 'react';
import type { RunTimeLayoutConfig as UmiRunTimeLayoutConfig } from '../.umi/plugin-layout/types.d';

declare module '@umijs/max' {
  export function defineConfig(config: Record<string, unknown>): Record<string, unknown>;

  export const history: {
    push: (path: string) => void;
    replace: (path: string) => void;
  };

  export function useModel<T = any>(namespace: string): T;

  export function useLocation(): {
    pathname: string;
    search: string;
    hash: string;
    state: unknown;
    key: string;
  };

  export type RunTimeLayoutConfig = UmiRunTimeLayoutConfig;
}

declare module '*.css' {
  const classes: Record<string, string>;
  export default classes;
}

declare module '*.scss' {
  const classes: Record<string, string>;
  export default classes;
}

declare namespace API {
  interface UserRoleItem {
    role: string;
    shopId?: string | null;
    status: string;
  }

  interface CurrentUser {
    id: string;
    name: string;
    role: string;
    shopId?: string;
    username?: string;
    nickName?: string;
    phone?: string;
    roles?: UserRoleItem[];
    avatar?: string;
  }
}

export interface LayoutAvatarRenderProps {
  defaultDom?: ReactNode;
}
