import { useEffect, useRef, PropsWithChildren } from 'react';
import Taro, { useDidShow } from '@tarojs/taro';
import { useAuthStore } from './stores/authStore';
import { connectSocket, disconnectSocket } from './services/socket';
import { ErrorBoundary } from './components/ErrorBoundary';
import './app.scss';

import MiniProgramWebSocket from './websocket-polyfill';
if (typeof globalThis !== 'undefined' && !globalThis.WebSocket) {
  (globalThis as any).WebSocket = MiniProgramWebSocket;
}

function connectWebSocket() {
  const authStore = useAuthStore.getState();
  if (authStore.token && authStore.user) {
    connectSocket(authStore.token, authStore.user.userId, authStore.user.role);
  }
}

function App({ children }: PropsWithChildren) {
  // 用于区分"小程序冷启动"和"从后台唤起"，避免每次 tab 切换都触发 refreshSession
  const isFirstShow = useRef(true);

  useEffect(() => {
    const authStore = useAuthStore.getState();
    const restored = authStore.restoreToken();

    if (restored) {
      connectWebSocket();
      // 恢复本地会话后立即同步最新角色/资料，避免审批通过后仍用旧缓存
      void useAuthStore.getState().fetchMe();
    } else {
      setTimeout(() => {
        Taro.reLaunch({ url: '/pages/auth/login' });
      }, 500);
    }

    const unsubscribe = useAuthStore.subscribe((state) => {
      if (state.isLoggedIn && state.token && state.user) {
        connectWebSocket();
      } else if (!state.isLoggedIn) {
        disconnectSocket();
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  useDidShow(() => {
    // 冷启动时跳过（token 恢复已在 useEffect 里处理）
    // 只在小程序从后台切回前台时刷新
    if (isFirstShow.current) {
      isFirstShow.current = false;
      return;
    }
    const auth = useAuthStore.getState();
    void auth.refreshSession();
    // 从后台回前台时同步角色，解决「申请已通过但切换入口未出现」
    void auth.fetchMe();
  });

  return (
    <ErrorBoundary>
      {children}
    </ErrorBoundary>
  );
}

export default App;