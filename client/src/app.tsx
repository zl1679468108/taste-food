import { useEffect, PropsWithChildren } from 'react';
import Taro, { useDidShow } from '@tarojs/taro';
import { useAuthStore } from './stores/authStore';
import { connectSocket, joinUserRoom, disconnectSocket } from './services/socket';
import RoleSwitcher from './components/RoleSwitcher';
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
  const isLoggedIn = useAuthStore((state) => state.isLoggedIn);

  useEffect(() => {
    const authStore = useAuthStore.getState();
    const restored = authStore.restoreToken();

    if (restored) {
      connectWebSocket();
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
    // 每次小程序唤起时尝试静默续期
    useAuthStore.getState().refreshSession();
  });

  return (
    <ErrorBoundary>
      {children}
      {isLoggedIn && <RoleSwitcher />}
    </ErrorBoundary>
  );
}

export default App;